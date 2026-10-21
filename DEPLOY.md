# Deploying Stow

## Which database to use on Vercel

Vercel is serverless: each request may run in a fresh container, and the filesystem is temporary. **SQLite cannot be used there**, and Stow now refuses to start rather than silently losing data.

| Option | Free tier | Works on Vercel | Verdict |
|---|---|---|---|
| **MongoDB Atlas (M0)** | 512 MB, shared | Yes | **Use this.** Stow already speaks MongoDB, and this is the path of least resistance. |
| Neon / Supabase (Postgres) | ~0.5 GB | Yes | Good, but needs a small storage adapter (`storage.py` has one interface, so it is a single class). |
| Upstash Redis | 256 MB | Yes | Fine for key/value, but no queries and awkward for expiry cleanup. |
| Vercel Postgres / KV | Free tier exists | Yes | Convenient, but tied to the platform and billed through it. |
| SQLite on a volume | n/a | **No** | Vercel has no persistent volume. This is the trap. |

**Recommendation: MongoDB Atlas M0.** It is free permanently, needs no credit card, and Stow already has the driver and the queries written.

### Setting up Atlas

1. Create an account at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a **free M0 cluster**; pick the region closest to your Vercel region.
3. **Database Access**: add a user with a strong password. This is not your Atlas login.
4. **Network Access**: add `0.0.0.0/0`. Vercel's functions have no fixed outbound IP on Hobby, so an allowlist of one address will not work. This is the single most common cause of "works locally, times out on Vercel".
5. **Connect → Drivers**: copy the connection string and add the database name:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/stow?retryWrites=true&w=majority
```

If your password contains `@`, `:`, `/` or `?`, percent-encode it first.

Free M0 limits: 512 MB storage, shared CPU, and it may pause after long inactivity. For a paste tool that is far more room than you need; an average paste is a few kilobytes.

## Deploying

### 1. Environment variables

Set these in Vercel under **Project → Settings → Environment Variables** (all environments):

| Name | Value |
|---|---|
| `MONGODB_URI` | your Atlas connection string |
| `SECRET_KEY` | a long random string |
| `BASE_URL` | `https://your-project.vercel.app` |

Generate the secret with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

All three are required. Stow fails at boot without them rather than degrading quietly:

- No `MONGODB_URI` on serverless means the SQLite fallback would lose every entry on each deploy, so it refuses to start.
- No `SECRET_KEY` means every cold start invalidates read tokens for protected entries, so it refuses to start.

### 2. Deploy

```bash
npm i -g vercel
vercel            # preview deployment
vercel --prod     # production
```

Or connect the GitHub repository in the Vercel dashboard and let every push deploy.

### 3. What Vercel builds

`vercel.json` configures it:

- **Build**: `cd frontend && npm install && npm run build`
- **Output**: `frontend/dist`
- **Function**: `api/index.py`, Python 3.12, 10 second limit
- **Rewrites**: `/api/*`, `/raw/*`, `/p/*`, `/edit/*`, `/about`, `/terms`, `/privacy` go to the Python function. Everything else is served as a static asset.

`api/index.py` is six lines: Vercel looks for a WSGI callable named `app`, and that file imports the real one from `app.py`. There is no second application to keep in sync.

### Plan requirement

**Python functions on Vercel require a paid plan.** As of writing, Hobby supports Node.js functions but not Python runtimes. If you are on Hobby, `vercel build` will fail on the Python runtime.

Two ways forward:

- **Pro plan**, which unlocks Python functions and this config as written.
- **Port the API to a Node serverless function.** The API is six endpoints and roughly 300 lines; `storage.py` and `app.py` are the only things that would need rewriting. Say the word and I will do it, but it is a real piece of work rather than a config change.

## Serverless behaviour to expect

- **Cold starts** add a few hundred milliseconds to the first request after idle. The Mongo client is created per instance, so the first query in a new instance includes the connection handshake.
- **Rate limits are per instance.** On serverless with several concurrent instances, the effective quota is multiplied by the instance count. This is a real limitation and it is documented on the API page rather than hidden.
- **No background jobs.** Expiry is checked when an entry is read, not by a scheduler, which is why the implementation deletes on access.

## Local development

Unchanged, and deliberately so:

```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python app.py
```

With no `MONGODB_URI`, Stow writes to `instance/stow.sqlite3`. Locally that is exactly what you want; on Vercel it is the thing being guarded against.
