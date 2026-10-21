# Stow

Put text away so a link can carry it. Paste code, logs, config, or a note; get a short link; share it. No account, no dashboard, no onboarding.

<sub>Formerly Orion Paste. Same tool, rebuilt from the interface up.</sub>

## What it does

- Paste text and get a short link at `/p/<slug>`, plus a plain-text copy at `/raw/<slug>`.
- Optional expiry from one day to ninety, or none at all. Expired entries are deleted on access and return 404.
- Optional password. **Read protection withholds the body server-side**, so the link alone opens nothing. Edit access always requires the password.
- Syntax highlighting for 27 languages, line numbers, wrap toggle, download, and raw view.
- Language is detected from what you paste, and you can override it.
- Per-address rate limits on creating, reading and unlocking, published in the API reference and enforced by the server.

## Documentation

| Page | Route | What it covers |
|---|---|---|
| API reference | `/api` | Every endpoint, request and response shapes, error codes, rate limits, and runnable examples in shell, Python and JavaScript. |
| Privacy notice | `/privacy` | What is stored, what is not collected, what lives in your browser, and how passwords work. |
| Terms of use | `/terms` | Acceptable use, content ownership, availability, and removal. |
| How it works | `/about` | Retention, protection, and what the service will not do. |

The API reference reads its limits, size cap and language list from `/api/meta` at runtime, so the page cannot drift out of date with the server that enforces them.

## Running it

Requires Python 3.11+ and Node 20+.

```bash
# 1. Backend dependencies
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Build the client
cd frontend
npm install
npm run build
cd ..

# 3. Run
python app.py
```

Open <http://localhost:5000>.

**Storage.** If `MONGODB_URI` is set, pastes go to MongoDB. Otherwise Stow creates a SQLite file at `instance/stow.sqlite3` and runs with no external service. Nothing else changes between the two.

### Front-end development

```bash
cd frontend
npm run dev      # http://localhost:5173, proxies /api and /raw to Flask on :5000
```

Run `python app.py` in another terminal. Vite proxies the API, so the dev server and the Flask process share one backend.

## Configuration

Copy `.env.example` to `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | unset | Use MongoDB instead of SQLite. |
| `SQLITE_PATH` | `instance/stow.sqlite3` | Where the fallback store lives. |
| `SECRET_KEY` | random per boot | Signs read tokens. **Set this in production**, or every restart invalidates open sessions. |
| `BASE_URL` | `http://localhost:5000` | Used for share links, canonical URLs and Open Graph tags. |
| `MAX_CONTENT_CHARS` | `500000` | Rejects oversized entries. |
| `RATE_CREATE_LIMIT` | `10` | New entries per address per minute. |
| `RATE_READ_LIMIT` | `120` | Reads per address per minute. |
| `RATE_UNLOCK_LIMIT` | `12` | Password attempts per address per minute. |
| `DEFAULT_EXPIRY_DAYS` | `0` | Applied when a request omits expiry. |
| `PORT` | `5000` | Flask's listen port. |

Rate limits are enforced in-process, so running N workers multiplies the effective quota by N. That is a deliberate trade for having no shared state to run. If you need real per-address quotas across workers, put the limits in a shared store or terminate them at your proxy.

## How it is built

```
app.py            JSON API + the HTML shell that hosts the client
storage.py        One interface, two backends: MongoDB and SQLite
ratelimit.py      In-process sliding-window limiter
test_app.py       33 smoke tests, weighted toward what must not leak
PRODUCT.md        What the product is and what it refuses to become
DESIGN.md         The visual system, in tokens
frontend/         React 19 + TypeScript + Vite
  src/routes/     Write, Read, Edit, About, Api, Terms, Privacy, Missing
  src/components/ Shell, Editor, SettingsRail, CodeView, Snippet, DocLayout, Toaster
  src/lib/        API client, language detection, formatting, Prism setup
```

Run the tests with `python -m pytest test_app.py -q`.

The Flask process serves both the API and the built client, so a paste link, its crawler preview and its raw body all come from one origin.

### SEO

`/p/<slug>` is rendered server-side with its real `<title>`, description, canonical URL and Open Graph tags already in the first response, plus the entry content inside `<noscript>`. Chat clients and crawlers see the entry without running JavaScript. Protected entries omit the body from that markup entirely, so protection is not a client-side trick.

## Security notes

- Pasted text is stored and displayed as text. It is never injected as HTML; the `dangerouslySetInnerHTML` calls in the highlighter receive Prism's own escaped output, never the raw entry.
- Read protection is enforced server-side: `/api/pastes/<slug>` returns metadata only, and `/raw/<slug>` returns 401, until a password is verified.
- Read tokens are HMAC-signed against the paste's current password hash, so rotating a password invalidates every token issued before it.
- Entries are addressed by a 7-character slug drawn from a 56-character alphabet (excluding characters that are misread aloud).
- Security headers (`nosniff`, `SAMEORIGIN`, `same-origin` referrer) are set on every response. API responses are `no-store`.

## License

[Apache License 2.0](LICENSE)

---

> Built by [truepushkar](https://github.com/truepushkar)
