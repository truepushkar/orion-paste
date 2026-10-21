# Deploying Stow

Stow is a single Flask process that serves both the JSON API and the built React client. That shape is deliberate: a paste link, its crawler preview and its raw body all come from one origin, with no cross-origin calls and no second service to keep in sync.

## Running it anywhere

```bash
# 1. Dependencies
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 2. Build the client
cd frontend && npm install && npm run build && cd ..

# 3. Run
MONGODB_URI="mongodb+srv://..." SECRET_KEY="..." python app.py
```

With `gunicorn` for production:

```bash
gunicorn --workers 4 --bind 0.0.0.0:8000 app:app
```

Set `BASE_URL` to the public origin so share links, canonical URLs and Open Graph tags point at the right host.

## Which database

| Option | Free tier | Notes |
|---|---|---|
| **MongoDB Atlas M0** | 512 MB | **Recommended.** Stow speaks it natively; no adapter needed. |
| SQLite | file on disk | The zero-config default for local runs. Needs a persistent volume. |
| Postgres (Neon, Supabase) | ~0.5 GB | Fine, but needs a small storage adapter. `storage.py` defines one interface, so it is a single class. |

### MongoDB Atlas setup

1. Create a free **M0** cluster at <https://www.mongodb.com/cloud/atlas/register>.
2. **Database Access**: add a user with a strong password. This is not your Atlas login.
3. **Network Access**: allow your host's outbound addresses. For a VPS that is its IP; for a platform with no fixed egress, `0.0.0.0/0`.
4. **Connect → Drivers**: copy the URI.

Atlas hands out URIs with **no database name in the path**:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

That is valid. Stow falls back to `MONGODB_DB`, then to `stow`. To be explicit, put the name before the `?`:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/stow?retryWrites=true&w=majority
```

Percent-encode any of `@ : / ?` that appear in your password.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | in production | Atlas connection string. Unset means SQLite, which only makes sense with a persistent disk. |
| `MONGODB_DB` | no | Database name when the URI omits one. Defaults to `stow`. |
| `SECRET_KEY` | in production | Signs read tokens. If it changes, every open protected session is invalidated. |
| `BASE_URL` | recommended | Public origin, used for links and canonical URLs. |
| `MAX_CONTENT_CHARS` | no | Entry size cap. Default `500000`. |
| `RATE_CREATE_LIMIT` | no | New entries per address per minute. Default `10`. |
| `RATE_READ_LIMIT` | no | Reads per address per minute. Default `120`. |
| `RATE_UNLOCK_LIMIT` | no | Password attempts per address per minute. Default `12`. |
| `PORT` | no | Listen port. Default `5000`. |

Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## A note on serverless

Stow is a long-lived process that owns a writable store. Serverless platforms run each request in a throwaway container with an ephemeral filesystem, which breaks two things here, so the code refuses to start rather than failing quietly:

- **Storage**: on a serverless platform with no `MONGODB_URI`, boot raises instead of writing SQLite to a temporary disk that loses every entry on the next deploy.
- **Sessions**: with no `SECRET_KEY`, boot raises instead of minting a key per cold start, which would invalidate every read token already handed out.

Those guards exist because both failures are silent. If you want to run this on a serverless host, use a host that gives you a real filesystem (Fly.io with a volume, Railway, Render, a VPS with Docker), or set `MONGODB_URI` and `SECRET_KEY` and accept the cold-start cost. Vercel's zero-config Flask preset owns request routing and does not cooperate with a custom rewrite table, so it is not a good fit without restructuring the app.

## Docker

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN cd frontend && npm install && npm run build   # requires node in a build stage

EXPOSE 8000
CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:8000", "app:app"]
```

For a smaller image, build the client in a `node:20` stage and copy `frontend/dist` into the final image.
