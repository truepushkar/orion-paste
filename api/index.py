"""Vercel entry point.

Vercel's Python runtime looks for a module-level WSGI application named `app`.
The rest of the project treats `app.py` as that module, so this file only has
to put the project root on the import path and re-export it.

Nothing else lives here: `api/` is a deployment detail, not a second
application, and duplicating logic between the two would be the fastest way to
ship a version that behaves differently in production than it does locally.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import app  # noqa: E402  (path must be set first)

# Vercel reads `app` as the WSGI callable.
__all__ = ["app"]
