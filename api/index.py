"""Vercel entry point.

Vercel's Python runtime looks for a module-level WSGI application named `app`.
The rest of the project treats `app.py` as that module, so this file only has
to make sure the original request path reaches Flask intact, then re-export it.

That middle part matters. A `rewrites` entry sends the request to
`/api/index.py`, and Vercel routes the rewritten destination path, so Flask
would see `/api/index.py` instead of `/api/pastes` and 404 everything. The
middleware below restores the path the visitor actually asked for, using the
header Vercel sets for exactly this purpose.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import app  # noqa: E402  (path must be set first)


class RestoreOriginalPath:
    """Put the public path back before Flask routes the request."""

    # Vercel sets one of these depending on how the request was rewritten.
    HEADERS = (
        "x-vercel-original-path",
        "x-forwarded-uri",
        "x-original-uri",
        "x-rewrite-url",
    )

    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")

        # Only intervene when the path looks like the function's own file,
        # which is the signature of a rewrite rather than a real route.
        if path.endswith("/api/index.py") or path == "/api/index.py":
            environ = dict(environ)
            for header in self.HEADERS:
                key = "HTTP_" + header.upper().replace("-", "_")
                candidate = environ.get(key)
                if candidate and candidate.startswith("/"):
                    environ["PATH_INFO"] = candidate
                    return self.wsgi_app(environ, start_response)

        return self.wsgi_app(environ, start_response)


app.wsgi_app = RestoreOriginalPath(app.wsgi_app)

__all__ = ["app"]
