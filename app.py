"""Stow - a quiet place to put text so a link can carry it.

The backend is a JSON API plus a static host for the built React client.
One process serves both, so a paste link, its crawler preview and its raw
body all come from the same origin.
"""

from __future__ import annotations

import hashlib
import hmac
import html
import os
import re
import secrets
import string
from datetime import timedelta
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

from storage import PasteStore, build_store, parse_ts, utcnow, SLUG_ALPHABET
from ratelimit import RateLimiter

load_dotenv()

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "frontend" / "dist"


def _resolve_dist() -> Path:
    """Where the built client lives.

    Locally that is `frontend/dist` beside this file. A serverless runtime may
    run the module from a different directory than the one the build output
    was placed in, so a few candidates are tried before giving up: serving the
    API with no client is worse than a slightly longer lookup.
    """
    candidates = [
        DIST,
        Path.cwd() / "frontend" / "dist",
        Path.cwd() / "dist",
        Path(os.getenv("STOW_DIST", "")) if os.getenv("STOW_DIST") else DIST,
    ]
    for candidate in candidates:
        if (candidate / "index.html").is_file():
            return candidate
    return DIST


app = Flask(__name__, static_folder=None)


class StripApiMount:
    """Undo a host that mounts this app under `/api`.

    Some platforms (Vercel's Python runtime among them) route every request
    through one function and set SCRIPT_NAME to the function's directory, so
    Flask is asked to route `/health` when the visitor requested
    `/api/health`, and every API route 404s with the HTML catch-all.

    This moves any leading path segment that looks like a mount back onto
    PATH_INFO. It only fires when SCRIPT_NAME is set, so a normal deployment
    and local development are untouched.
    """

    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        script = environ.get("SCRIPT_NAME", "")
        if not script or script == "/":
            return self.wsgi_app(environ, start_response)

        environ = dict(environ)
        mount = script.rstrip("/")
        environ["SCRIPT_NAME"] = ""
        environ["PATH_INFO"] = mount + environ.get("PATH_INFO", "")
        return self.wsgi_app(environ, start_response)


app.wsgi_app = StripApiMount(app.wsgi_app)


def _resolve_secret() -> str:
    """The key behind read tokens.

    A random key is fine on a laptop, where the process is long-lived and the
    tokens only need to outlast the tab. On a serverless platform it is a bug:
    every cold start would mint a new key and silently invalidate every read
    token already handed out, so a visitor who unlocked a protected entry
    would find it sealed again on the next request. There, a missing key is a
    configuration error worth failing on.
    """
    configured = (os.getenv("SECRET_KEY") or "").strip()
    if configured:
        return configured

    if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        raise RuntimeError(
            "SECRET_KEY must be set on a serverless deployment. Without it "
            "each cold start generates a new key and invalidates every read "
            "token for protected entries. Generate one with: "
            "python -c \"import secrets; print(secrets.token_hex(32))\""
        )

    return secrets.token_hex(32)


app.secret_key = _resolve_secret()

BASE_URL = os.getenv("BASE_URL", "http://localhost:5000").rstrip("/")
DEFAULT_EXPIRY_DAYS = int(os.getenv("DEFAULT_EXPIRY_DAYS", "0"))
MAX_CONTENT_CHARS = int(os.getenv("MAX_CONTENT_CHARS", "500000"))
SLUG_LENGTH = 7

# Published limits. The API reference states these numbers, so they live here
# where the enforcement is, and the docs quote them rather than restating them.
RATE_CREATE = RateLimiter(limit=int(os.getenv("RATE_CREATE_LIMIT", "10")), window_seconds=60)
RATE_READ = RateLimiter(limit=int(os.getenv("RATE_READ_LIMIT", "120")), window_seconds=60)
RATE_UNLOCK = RateLimiter(limit=int(os.getenv("RATE_UNLOCK_LIMIT", "12")), window_seconds=60)
RATE_LIMITS = {
    "create": RATE_CREATE.limit,
    "read": RATE_READ.limit,
    "unlock": RATE_UNLOCK.limit,
    "window": 60,
}

store: PasteStore = build_store(str(ROOT))

# Aliases the highlighter knows. Anything else is stored verbatim and rendered
# as plain text, which is safe but not colourful.
LANGUAGES = {
    "markdown", "plain", "bash", "c", "cpp", "csharp", "css", "diff", "go",
    "graphql", "ini", "java", "javascript", "json", "jsx", "kotlin", "less",
    "lua", "markup", "php", "python", "ruby", "rust", "scss", "sql", "swift",
    "toml", "tsx", "typescript", "yaml",
}

# The value a new entry gets when the client sends nothing. Markdown, because
# most pasted text is prose with some structure in it.
DEFAULT_LANGUAGE = "markdown"

ALIASES = {
    "js": "javascript", "ts": "typescript", "py": "python", "yml": "yaml",
    "sh": "bash", "shell": "bash", "zsh": "bash", "html": "markup", "xml": "markup",
    "svg": "markup", "text": "plain", "txt": "plain", "md": "markdown",
    "markdown": "markdown", "gfm": "markdown", "cs": "csharp", "c++": "cpp",
    "rs": "rust", "rb": "ruby", "kt": "kotlin",
    "golang": "go", "dockerfile": "bash", "docker": "bash", "env": "ini", "conf": "ini",
}


def normalise_language(value: str | None) -> str:
    """Map a client's language to a grammar we actually have.

    An empty value is not an error: it means "you decide", so it takes the
    deployment default rather than the least useful fallback.
    """
    candidate = (value or "").strip().lower()
    if not candidate:
        return DEFAULT_LANGUAGE
    candidate = ALIASES.get(candidate, candidate)
    return candidate if candidate in LANGUAGES else "plain"


def generate_slug(length: int = SLUG_LENGTH) -> str:
    return "".join(secrets.choice(SLUG_ALPHABET) for _ in range(length))


def issue_token(slug: str, password_hash: str) -> str:
    """A stateless read token: no session, no cookie, still unguessable.

    It is bound to the paste's *current* password hash, so rotating the
    password by any future path invalidates every token handed out before.
    """
    message = f"{slug}:{password_hash}".encode()
    return hmac.new(app.secret_key.encode(), message, hashlib.sha256).hexdigest()


def token_is_valid(slug: str, paste: dict, token: str | None) -> bool:
    if not token or not paste.get("password_hash"):
        return False
    return hmac.compare_digest(issue_token(slug, paste["password_hash"]), token)


def fetch(slug: str) -> dict | None:
    """Read a paste, deleting it first if its expiry has passed."""
    paste = store.get(slug)
    if not paste:
        return None
    expires_at = parse_ts(paste.get("expires_at"))
    if expires_at and utcnow() > expires_at:
        store.delete(slug)
        return None
    return paste


def json_error(message: str, status: int, **extra):
    return jsonify({"error": message, **extra}), status


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    return forwarded.split(",")[0].strip() if forwarded else (request.remote_addr or "")


def rate_limited(limiter: RateLimiter, scope: str):
    """Return a 429 response when this client is over its quota, else None.

    The window applies per client address and per scope, so a burst of reads
    never consumes the quota for creating entries.
    """
    allowed, retry_after = limiter.check(f"{scope}:{client_ip()}")
    if allowed:
        return None

    response = jsonify(
        {
            "error": f"Too many requests. Try again in {retry_after} seconds.",
            "retryAfter": retry_after,
        }
    )
    response.headers["Retry-After"] = str(retry_after)
    response.headers["X-RateLimit-Limit"] = str(limiter.limit)
    response.headers["X-RateLimit-Window"] = str(limiter.window)
    return response, 429


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify(
        {
            "ok": True,
            "storage": store.name,
            "maxContentChars": MAX_CONTENT_CHARS,
            "limits": RATE_LIMITS,
        }
    )


@app.get("/api/meta")
def meta():
    """Everything the API reference needs to describe this deployment.

    The docs are static, so anything deployment-specific (the limits, the
    size cap, the language list) is fetched from here rather than hard-coded
    into the page and quietly drifting out of date.
    """
    return jsonify(
        {
            "name": "Stow",
            "version": "2.0",
            "baseUrl": BASE_URL,
            "maxContentChars": MAX_CONTENT_CHARS,
            "limits": RATE_LIMITS,
            "slugLength": SLUG_LENGTH,
            "slugAlphabet": SLUG_ALPHABET,
            "languages": sorted(LANGUAGES),
            "defaultLanguage": DEFAULT_LANGUAGE,
            "endpoints": [
                {"method": "POST", "path": "/api/pastes"},
                {"method": "GET", "path": "/api/pastes/{slug}"},
                {"method": "POST", "path": "/api/pastes/{slug}/unlock"},
                {"method": "POST", "path": "/api/pastes/{slug}/edit"},
                {"method": "GET", "path": "/raw/{slug}"},
                {"method": "GET", "path": "/api/health"},
                {"method": "GET", "path": "/api/meta"},
            ],
        }
    )


@app.post("/api/pastes")
def create_paste():
    limited = rate_limited(RATE_CREATE, "create")
    if limited:
        return limited

    payload = request.get_json(silent=True) or {}
    content = (payload.get("content") or "").strip("\n")
    if not content.strip():
        return json_error("An entry needs some text before it can be stowed.", 400)

    if len(content) > MAX_CONTENT_CHARS:
        return json_error(
            f"That entry is over {MAX_CONTENT_CHARS:,} characters. Split it into parts.",
            413,
        )

    password = (payload.get("password") or "").strip()
    protect_read = bool(payload.get("protectRead", True)) and bool(password)

    days = payload.get("expireDays", DEFAULT_EXPIRY_DAYS)
    try:
        days = int(days or 0)
    except (TypeError, ValueError):
        days = 0
    days = max(0, min(days, 3650))

    slug = generate_slug()
    for _ in range(5):
        if not store.get(slug):
            break
        slug = generate_slug(SLUG_LENGTH + 1)

    now = utcnow()
    paste = {
        "slug": slug,
        "title": (payload.get("title") or "").strip()[:160],
        "language": normalise_language(payload.get("language")),
        "content": content,
        "created_at": now,
        "updated_at": None,
        "expires_at": now + timedelta(days=days) if days else None,
        "password_hash": generate_password_hash(password) if password else None,
        "protect_read": protect_read,
    }
    store.insert(paste)

    body = {
        "slug": slug,
        "url": f"{BASE_URL}/p/{slug}",
        "rawUrl": f"{BASE_URL}/raw/{slug}",
        "title": paste["title"],
        "language": paste["language"],
        "expiresAt": paste["expires_at"].isoformat() if paste["expires_at"] else None,
        "protected": protect_read,
        "editable": bool(password),
    }
    if password:
        body["token"] = issue_token(slug, paste["password_hash"])
    return jsonify(body), 201


@app.get("/api/pastes/<slug>")
def read_paste(slug: str):
    limited = rate_limited(RATE_READ, "read")
    if limited:
        return limited

    paste = fetch(slug)
    if not paste:
        return json_error("This entry is not here. It may have expired.", 404)

    protect_read = bool(paste.get("protect_read")) and bool(paste.get("password_hash"))
    if protect_read and not token_is_valid(slug, paste, request.args.get("token")):
        return jsonify(
            {
                "slug": slug,
                "protected": True,
                "title": paste.get("title") or "",
                "createdAt": _iso(paste.get("created_at")),
                "expiresAt": _iso(paste.get("expires_at")),
            }
        )

    return jsonify(_public_paste(paste))


@app.post("/api/pastes/<slug>/unlock")
def unlock_paste(slug: str):
    limited = rate_limited(RATE_UNLOCK, "unlock")
    if limited:
        return limited

    paste = fetch(slug)
    if not paste:
        return json_error("This entry is not here. It may have expired.", 404)

    password = (request.get_json(silent=True) or {}).get("password") or ""
    if not paste.get("password_hash") or not check_password_hash(
        paste["password_hash"], password
    ):
        return json_error("That password does not open this entry.", 401)

    body = _public_paste(paste)
    body["token"] = issue_token(slug, paste["password_hash"])
    body["protected"] = bool(paste.get("protect_read"))
    return jsonify(body)


@app.post("/api/pastes/<slug>/edit")
def edit_paste(slug: str):
    paste = fetch(slug)
    if not paste:
        return json_error("This entry is not here. It may have expired.", 404)
    if not paste.get("password_hash"):
        return json_error(
            "This entry was stowed without a password, so it cannot be changed.", 403
        )

    payload = request.get_json(silent=True) or {}
    if not check_password_hash(paste["password_hash"], payload.get("password") or ""):
        return json_error("That password does not open this entry.", 401)

    content = (payload.get("content") or "").strip("\n")
    if not content.strip():
        return json_error("An entry needs some text before it can be saved.", 400)
    if len(content) > MAX_CONTENT_CHARS:
        return json_error(f"That entry is over {MAX_CONTENT_CHARS:,} characters.", 413)

    fields = {
        "content": content,
        "title": (payload.get("title") or "").strip()[:160],
        "language": normalise_language(payload.get("language")),
        "updated_at": utcnow(),
    }
    store.update(slug, fields)

    body = _public_paste({**paste, **fields})
    body["token"] = issue_token(slug, paste["password_hash"])
    return jsonify(body)


@app.get("/raw/<slug>")
def raw_paste(slug: str):
    paste = fetch(slug)
    if not paste:
        return Response("This entry is not here.", status=404, mimetype="text/plain")

    protect_read = bool(paste.get("protect_read")) and bool(paste.get("password_hash"))
    if protect_read and not token_is_valid(slug, paste, request.args.get("token")):
        # Cache-friendly protection: the body is withheld, not hidden by CSS.
        return Response(
            "This entry is protected. Open the link and enter its password.",
            status=401,
            mimetype="text/plain",
        )

    return Response(paste["content"], mimetype="text/plain; charset=utf-8")


def _iso(value) -> str | None:
    parsed = parse_ts(value)
    return parsed.isoformat() if parsed else None


def _public_paste(paste: dict) -> dict:
    return {
        "slug": paste["slug"],
        "title": paste.get("title") or "",
        "language": paste.get("language") or "plain",
        "content": paste["content"],
        "createdAt": _iso(paste.get("created_at")),
        "updatedAt": _iso(paste.get("updated_at")),
        "expiresAt": _iso(paste.get("expires_at")),
        "protected": bool(paste.get("protect_read")) and bool(paste.get("password_hash")),
        "editable": bool(paste.get("password_hash")),
        "lines": paste["content"].count("\n") + 1,
        "chars": len(paste["content"]),
        "rawUrl": f"{BASE_URL}/raw/{paste['slug']}",
    }


# --------------------------------------------------------------------------
# Client shell, with real metadata injected per route
# --------------------------------------------------------------------------

DEFAULT_TITLE = "Stow - put text away so a link can carry it"
DEFAULT_DESCRIPTION = (
    "Paste text or code, get a short link. Optional expiry, optional password, "
    "no account. Stow keeps the entry and hands back the link."
)


def _read_index() -> str:
    index = _resolve_dist() / "index.html"
    if not index.exists():
        return (
            "<!doctype html><meta charset='utf-8'><title>Stow</title>"
            "<body style='font-family:system-ui;padding:3rem;background:#0b1420;color:#e8e2d4'>"
            "<h1>Stow</h1><p>The client has not been built yet.</p>"
            "<pre style='color:#93a1af'>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</pre>"
        )
    return index.read_text(encoding="utf-8")


# Static pages: path -> (title, description). Their head tags are baked into
# the first response for the same reason a paste's are: a crawler should not
# have to run the client to learn what the page is.
STATIC_PAGES = {
    "/about": (
        "How Stow works - retention, protection and limits",
        "How Stow stores text: optional expiry, read-protected entries, "
        "rate limits, and what the service will not do.",
    ),
    "/api": (
        "API reference - Stow",
        "The Stow JSON API: create, read, unlock and edit entries. "
        "Endpoints, request and response shapes, error codes and rate limits.",
    ),
    "/terms": (
        "Terms of use - Stow",
        "Acceptable use, your content, availability and liability for the "
        "Stow paste service.",
    ),
    "/privacy": (
        "Privacy notice - Stow",
        "What Stow stores, what it does not collect, how passwords and read "
        "protection work, and what lives in your browser.",
    ),
}


def shell(paste: dict | None = None, status: int = 200, page: str | None = None):
    """Serve index.html with route-specific head tags baked in.

    This is what makes a paste link preview correctly in chat clients and
    index correctly in search: the title, description and Open Graph image
    are in the first response, not assembled later by JavaScript.
    """
    markup = _read_index()

    if paste:
        title = paste.get("title") or f"Entry {paste['slug']}"
        raw = paste["content"]
        snippet = re.sub(r"\s+", " ", raw).strip()[:180]
        description = snippet or DEFAULT_DESCRIPTION
        lang = paste.get("language") or "plain"
        page_title = f"{title} - Stow"
        canonical = f"{BASE_URL}/p/{paste['slug']}"
        og_type = "article"
    elif page and page in STATIC_PAGES:
        page_title, description = STATIC_PAGES[page]
        lang = "plain"
        canonical = f"{BASE_URL}{page}"
        og_type = "website"
    elif status == 404:
        title = "Entry not found"
        page_title = "Nothing here - Stow"
        description = (
            "There is nothing at this address. The link may be mistyped, or the "
            "entry reached the end of its retention and was deleted."
        )
        lang = "plain"
        canonical = BASE_URL
        og_type = "website"
    else:
        title, page_title = DEFAULT_TITLE, DEFAULT_TITLE
        description, lang = DEFAULT_DESCRIPTION, "plain"
        canonical, og_type = BASE_URL, "website"

    esc = html.escape
    head = f"""
    <title>{esc(page_title)}</title>
    <meta name="description" content="{esc(description)}">
    <link rel="canonical" href="{esc(canonical)}">
    <meta property="og:site_name" content="Stow">
    <meta property="og:type" content="{og_type}">
    <meta property="og:title" content="{esc(page_title)}">
    <meta property="og:description" content="{esc(description)}">
    <meta property="og:url" content="{esc(canonical)}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="{esc(page_title)}">
    <meta name="twitter:description" content="{esc(description)}">
    """
    if paste:
        head += f'    <meta name="robots" content="noindex, follow">\n'
    elif status == 404:
        head += '    <meta name="robots" content="noindex">\n'

    markup = re.sub(r"<title>.*?</title>", "", markup, count=1, flags=re.S)
    markup = markup.replace("</head>", head + "  </head>", 1)

    if paste:
        # A readable document for crawlers and for anyone with JS disabled.
        pre = esc(paste["content"])
        markup = markup.replace(
            '<div id="root"></div>',
            f'<div id="root"></div><noscript><pre class="seo-entry" '
            f'data-lang="{esc(lang)}">{pre}</pre></noscript>',
            1,
        )
    return Response(markup, status=status, mimetype="text/html")


@app.get("/")
def home():
    return shell()


@app.get("/p/<slug>")
def paste_page(slug: str):
    paste = fetch(slug)
    if not paste:
        markup = _read_index()
        head = (
            "<title>Entry not found - Stow</title>"
            '<meta name="robots" content="noindex">'
        )
        markup = re.sub(r"<title>.*?</title>", "", markup, count=1, flags=re.S)
        markup = markup.replace("</head>", head + "  </head>", 1)
        return Response(markup, status=404, mimetype="text/html")

    protect_read = bool(paste.get("protect_read")) and bool(paste.get("password_hash"))
    if protect_read:
        # Protected entries must not leak a preview into the crawler head.
        redacted = {
            "slug": slug,
            "title": paste.get("title") or "Protected entry",
            "content": "",
            "language": paste.get("language") or "plain",
        }
        return shell(redacted)
    return shell(paste)


@app.get("/edit/<slug>")
def edit_page(slug: str):
    return shell(fetch(slug))


@app.get("/<path:path>")
def static_files(path: str):
    if path.startswith("api/") or path.startswith("raw/"):
        return json_error("Not found", 404)
    dist = _resolve_dist()
    target = dist / path
    if target.is_file():
        return send_from_directory(dist, path)

    # A known document gets its own head tags. An unknown path is still served
    # the client (so the router can render its own 404), but with a real 404
    # status and a noindex tag, because a soft 200 on a missing page invites
    # crawlers to index every typo.
    route = f"/{path.rstrip('/')}"
    if route in STATIC_PAGES:
        return shell(page=route)
    return shell(None, status=404)


@app.errorhandler(404)
def handle_404(_error):
    if request.path.startswith(("/api/", "/raw/")):
        return json_error("Not found", 404)
    return shell(None, status=404)


@app.errorhandler(500)
def handle_500(_error):
    if request.path.startswith(("/api/", "/raw/")):
        return json_error("Stow hit an internal error. The entry was not saved.", 500)
    return shell(None, status=500)


@app.after_request
def headers(response: Response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
