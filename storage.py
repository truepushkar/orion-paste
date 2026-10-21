"""Storage for Stow.

Two interchangeable backends behind one interface:

- MongoDB, used whenever MONGODB_URI is set. This is the production path.
- SQLite, used otherwise, so a checkout runs with no external service.

Both store UTC ISO-8601 timestamps and return plain dicts, so the rest of the
application never learns which one it is talking to.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any

try:
    from pymongo import MongoClient, ASCENDING
    from pymongo.errors import PyMongoError
except ImportError:  # pragma: no cover - pymongo is a hard requirement in prod
    MongoClient = None  # type: ignore[assignment]

    class PyMongoError(Exception):  # type: ignore[no-redef]
        pass


SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
# 1, 0, l and O are left out so a slug can be read aloud over a call.


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_ts(value: Any) -> datetime | None:
    """Accept a datetime from Mongo or an ISO string from SQLite."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


class PasteStore:
    """The interface every backend implements."""

    name = "abstract"

    def insert(self, paste: dict[str, Any]) -> None:
        raise NotImplementedError

    def get(self, slug: str) -> dict[str, Any] | None:
        raise NotImplementedError

    def update(self, slug: str, fields: dict[str, Any]) -> bool:
        raise NotImplementedError

    def delete(self, slug: str) -> None:
        raise NotImplementedError

    def purge_expired(self) -> int:
        """Drop pastes whose expiry has passed. Returns the count removed."""
        raise NotImplementedError

    def close(self) -> None:
        pass


class MongoStore(PasteStore):
    name = "mongodb"

    def __init__(self, uri: str, pool_size: int = 50) -> None:
        if MongoClient is None:
            raise RuntimeError("pymongo is required when MONGODB_URI is set")
        self.client = MongoClient(
            uri,
            maxPoolSize=pool_size,
            minPoolSize=1,
            maxIdleTimeMS=45_000,
            serverSelectionTimeoutMS=5_000,
            connectTimeoutMS=10_000,
        )
        database = self.client.get_default_database()
        self.collection = database.pastes
        self.collection.create_index([("slug", ASCENDING)], unique=True, background=True)
        self.collection.create_index([("expires_at", ASCENDING)], background=True)

    def insert(self, paste: dict[str, Any]) -> None:
        self.collection.insert_one(dict(paste))

    def get(self, slug: str) -> dict[str, Any] | None:
        return self.collection.find_one({"slug": slug}, {"_id": 0})

    def update(self, slug: str, fields: dict[str, Any]) -> bool:
        result = self.collection.update_one({"slug": slug}, {"$set": fields})
        return bool(result.matched_count)

    def delete(self, slug: str) -> None:
        self.collection.delete_one({"slug": slug})

    def purge_expired(self) -> int:
        result = self.collection.delete_many({"expires_at": {"$ne": None, "$lt": utcnow()}})
        return int(result.deleted_count)

    def close(self) -> None:
        self.client.close()


class SQLiteStore(PasteStore):
    name = "sqlite"

    SCHEMA = """
    CREATE TABLE IF NOT EXISTS pastes (
        slug          TEXT PRIMARY KEY,
        title         TEXT NOT NULL DEFAULT '',
        language      TEXT NOT NULL DEFAULT '',
        content       TEXT NOT NULL,
        created_at    TEXT NOT NULL,
        updated_at    TEXT,
        expires_at    TEXT,
        password_hash TEXT,
        protect_read  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS pastes_expires ON pastes(expires_at);
    """

    def __init__(self, path: str) -> None:
        self.path = path
        self._lock = threading.Lock()
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.executescript(self.SCHEMA)
        self._migrate()
        self._connection.commit()

    def _migrate(self) -> None:
        """Add columns introduced after a database was first created.

        A store that silently drops a security flag is worse than one that
        refuses to open, so an older file is upgraded in place rather than
        being read with the flag missing.
        """
        present = {
            row["name"]
            for row in self._connection.execute("PRAGMA table_info(pastes)")
        }
        if "protect_read" not in present:
            self._connection.execute(
                "ALTER TABLE pastes ADD COLUMN protect_read INTEGER NOT NULL DEFAULT 0"
            )

    def _row(self, slug: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            "SELECT * FROM pastes WHERE slug = ?", (slug,)
        ).fetchone()
        if not row:
            return None
        paste = dict(row)
        paste["protect_read"] = bool(paste.get("protect_read"))
        return paste

    def insert(self, paste: dict[str, Any]) -> None:
        with self._lock:
            self._connection.execute(
                """INSERT INTO pastes
                   (slug, title, language, content, created_at, updated_at,
                    expires_at, password_hash, protect_read)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    paste["slug"],
                    paste.get("title") or "",
                    paste.get("language") or "",
                    paste["content"],
                    paste["created_at"].isoformat(),
                    None,
                    paste["expires_at"].isoformat() if paste.get("expires_at") else None,
                    paste.get("password_hash"),
                    1 if paste.get("protect_read") else 0,
                ),
            )
            self._connection.commit()

    def get(self, slug: str) -> dict[str, Any] | None:
        paste = self._row(slug)
        if not paste:
            return None
        paste["created_at"] = parse_ts(paste["created_at"])
        paste["expires_at"] = parse_ts(paste["expires_at"])
        paste["updated_at"] = parse_ts(paste["updated_at"])
        return paste

    def update(self, slug: str, fields: dict[str, Any]) -> bool:
        if not fields:
            return bool(self._row(slug))
        assignments = ", ".join(f"{key} = ?" for key in fields)
        values = [
            value.isoformat() if isinstance(value, datetime) else value
            for value in fields.values()
        ]
        with self._lock:
            cursor = self._connection.execute(
                f"UPDATE pastes SET {assignments} WHERE slug = ?", (*values, slug)
            )
            self._connection.commit()
            return cursor.rowcount > 0

    def delete(self, slug: str) -> None:
        with self._lock:
            self._connection.execute("DELETE FROM pastes WHERE slug = ?", (slug,))
            self._connection.commit()

    def purge_expired(self) -> int:
        with self._lock:
            cursor = self._connection.execute(
                "DELETE FROM pastes WHERE expires_at IS NOT NULL AND expires_at < ?",
                (utcnow().isoformat(),),
            )
            self._connection.commit()
            return cursor.rowcount

    def close(self) -> None:
        self._connection.close()


def is_serverless() -> bool:
    """True when running somewhere with no writable disk that survives a
    request, which today means Vercel."""
    return bool(
        os.getenv("VERCEL")
        or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
        or os.getenv("NETLIFY")
    )


def build_store(app_root: str) -> PasteStore:
    """Pick a backend from the environment.

    Locally: MongoDB when MONGODB_URI is set, otherwise a SQLite file, so a
    checkout runs with no external service.

    On a serverless platform there is no disk to fall back to. A paste written
    to /tmp is gone with the instance, so a silent SQLite fallback would look
    like it worked and then lose every entry on the next deploy. In that case
    a misconfiguration is raised instead, because a loud failure at boot is
    cheaper than quiet data loss later.
    """
    uri = os.getenv("MONGODB_URI", "").strip()
    serverless = is_serverless()

    if uri:
        try:
            store = MongoStore(uri)
            store.collection.database.command("ping")
            return store
        except Exception as error:  # noqa: BLE001
            if serverless:
                raise RuntimeError(
                    "MONGODB_URI is set but the database is unreachable "
                    f"({error}). On serverless there is no local fallback: "
                    "fix the connection string, and make sure the cluster's "
                    "network access allows 0.0.0.0/0 so Vercel can reach it."
                ) from error
            print(f"[stow] MongoDB unavailable ({error}); falling back to SQLite")
    elif serverless:
        raise RuntimeError(
            "MONGODB_URI is not set. Stow is running on a serverless platform, "
            "where the filesystem is temporary and shared between deployments "
            "is impossible, so the SQLite fallback would silently lose every "
            "entry. Set MONGODB_URI in the project's environment variables."
        )

    path = os.getenv("SQLITE_PATH", os.path.join(app_root, "instance", "stow.sqlite3"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return SQLiteStore(path)
