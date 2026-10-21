"""Smoke tests for the Stow API. Run with: python -m pytest test_app.py -q

These exercise the security-critical paths, not the happy path only: a paste
tool's failure mode is a leaked body, so every test here is about what must
*not* come back.
"""

from __future__ import annotations

import os
import tempfile

import pytest

_TEMP_DB = os.path.join(tempfile.mkdtemp(), "stow-test.sqlite3")
os.environ["SQLITE_PATH"] = _TEMP_DB
os.environ.pop("MONGODB_URI", None)
os.environ["SECRET_KEY"] = "test-key-not-for-production"

import app as stow  # noqa: E402  (environment must be set first)


@pytest.fixture()
def client():
    """A client with a fresh rate-limit budget.

    The limiters live in the process, not the test client, so without a reset
    a suite that creates a paste in twenty tests exhausts a ten-per-minute
    quota and starts asserting against 429s instead of the behaviour under
    test. Resetting here keeps each test honest about what it is checking.
    """
    stow.app.config.update(TESTING=True)
    for limiter in (stow.RATE_CREATE, stow.RATE_READ, stow.RATE_UNLOCK):
        limiter.reset()
    with stow.app.test_client() as test_client:
        yield test_client
    for limiter in (stow.RATE_CREATE, stow.RATE_READ, stow.RATE_UNLOCK):
        limiter.reset()


def make_paste(client, **overrides):
    payload = {
        "content": "def relieve(outgoing, incoming):\n    return 0\n",
        "title": "Watch change",
        "language": "python",
        "expireDays": 7,
        "password": "",
        "protectRead": True,
    }
    payload.update(overrides)
    return client.post("/api/pastes", json=payload)


def test_health_reports_storage(client):
    body = client.get("/api/health").get_json()
    assert body["ok"] is True
    assert body["storage"] in {"sqlite", "mongodb"}


def test_create_and_read_open_paste(client):
    created = make_paste(client).get_json()
    assert len(created["slug"]) == 7
    assert created["protected"] is False

    read = client.get(f"/api/pastes/{created['slug']}").get_json()
    assert read["content"].startswith("def relieve")
    assert read["language"] == "python"


def test_empty_content_is_rejected(client):
    response = make_paste(client, content="   \n  ")
    assert response.status_code == 400


def test_language_aliases_are_normalised(client):
    created = make_paste(client, language="py").get_json()
    assert created["language"] == "python"


def test_unknown_language_falls_back_to_plain(client):
    created = make_paste(client, language="brainfuck").get_json()
    assert created["language"] == "plain"


def test_missing_language_takes_the_default(client):
    created = make_paste(client, language="").get_json()
    assert created["language"] == stow.DEFAULT_LANGUAGE
    assert stow.DEFAULT_LANGUAGE == "markdown"


def test_markdown_is_accepted_and_stored(client):
    created = make_paste(client, language="md").get_json()
    assert created["language"] == "markdown"

    read = client.get(f"/api/pastes/{created['slug']}").get_json()
    assert read["language"] == "markdown"


def test_meta_publishes_the_default_language(client):
    body = client.get("/api/meta").get_json()
    assert body["defaultLanguage"] == "markdown"
    assert "markdown" in body["languages"]


def test_protected_paste_withholds_body_from_anonymous_reader(client):
    created = make_paste(client, password="harbor-lamp", protectRead=True).get_json()
    assert created["protected"] is True

    body = client.get(f"/api/pastes/{created['slug']}").get_json()
    assert "content" not in body
    assert body["protected"] is True


def test_wrong_password_is_refused(client):
    created = make_paste(client, password="harbor-lamp").get_json()
    response = client.post(
        f"/api/pastes/{created['slug']}/unlock", json={"password": "wrong"}
    )
    assert response.status_code == 401
    assert "content" not in response.get_json()


def test_right_password_returns_body_and_token(client):
    created = make_paste(client, password="harbor-lamp").get_json()
    body = client.post(
        f"/api/pastes/{created['slug']}/unlock", json={"password": "harbor-lamp"}
    ).get_json()
    assert body["content"].startswith("def relieve")
    assert body["token"]


def test_token_grants_read_access(client):
    created = make_paste(client, password="harbor-lamp").get_json()
    token = client.post(
        f"/api/pastes/{created['slug']}/unlock", json={"password": "harbor-lamp"}
    ).get_json()["token"]

    body = client.get(f"/api/pastes/{created['slug']}?token={token}").get_json()
    assert "content" in body


def test_raw_withholds_body_without_token(client):
    created = make_paste(client, password="harbor-lamp").get_json()
    response = client.get(f"/raw/{created['slug']}")
    assert response.status_code == 401
    assert b"relieve" not in response.data


def test_raw_serves_body_with_token(client):
    created = make_paste(client, password="harbor-lamp").get_json()
    token = client.post(
        f"/api/pastes/{created['slug']}/unlock", json={"password": "harbor-lamp"}
    ).get_json()["token"]

    response = client.get(f"/raw/{created['slug']}?token={token}")
    assert response.status_code == 200
    assert b"def relieve" in response.data


def test_raw_serves_unprotected_paste_freely(client):
    created = make_paste(client).get_json()
    response = client.get(f"/raw/{created['slug']}")
    assert response.status_code == 200
    assert b"def relieve" in response.data


def test_password_without_read_protection_still_allows_reading(client):
    created = make_paste(
        client, password="harbor-lamp", protectRead=False
    ).get_json()
    body = client.get(f"/api/pastes/{created['slug']}").get_json()
    assert "content" in body
    assert body["protected"] is False


def test_edit_requires_password(client):
    created = make_paste(client, password="harbor-lamp").get_json()
    response = client.post(
        f"/api/pastes/{created['slug']}/edit",
        json={"content": "# changed\n", "password": "wrong"},
    )
    assert response.status_code == 401


def test_edit_without_any_password_is_refused(client):
    created = make_paste(client).get_json()
    response = client.post(
        f"/api/pastes/{created['slug']}/edit",
        json={"content": "# changed\n", "password": "anything"},
    )
    assert response.status_code == 403


def test_edit_with_password_rewrites_content(client):
    created = make_paste(client, password="harbor-lamp").get_json()
    body = client.post(
        f"/api/pastes/{created['slug']}/edit",
        json={"content": "# changed\n", "title": "New", "language": "bash",
              "password": "harbor-lamp"},
    ).get_json()
    assert body["content"] == "# changed"
    assert body["title"] == "New"


def test_missing_slug_returns_404(client):
    assert client.get("/api/pastes/doesnotexist").status_code == 404


def test_expired_paste_is_deleted_on_access(client):
    created = make_paste(client, expireDays=0).get_json()
    slug = created["slug"]

    # Reach behind the API and force the expiry into the past.
    from datetime import timedelta

    stow.store.update(slug, {"expires_at": stow.utcnow() - timedelta(seconds=5)})

    assert client.get(f"/api/pastes/{slug}").status_code == 404
    assert stow.store.get(slug) is None


def test_oversized_entry_is_rejected(client):
    limit = stow.MAX_CONTENT_CHARS
    response = make_paste(client, content="x" * (limit + 1))
    assert response.status_code == 413


def test_paste_page_carries_real_metadata(client):
    created = make_paste(client, title="Deploy notes").get_json()
    page = client.get(f"/p/{created['slug']}").get_data(as_text=True)
    assert "Deploy notes" in page
    assert 'property="og:title"' in page
    assert f'/p/{created["slug"]}' in page
    assert 'name="robots" content="noindex' in page


def test_protected_page_does_not_leak_content_into_markup(client):
    created = make_paste(
        client, password="harbor-lamp", content="SECRET-BODY-TEXT\n"
    ).get_json()
    page = client.get(f"/p/{created['slug']}").get_data(as_text=True)
    assert "SECRET-BODY-TEXT" not in page


def test_unknown_page_returns_404_html(client):
    response = client.get("/p/nope")
    assert response.status_code == 404
    assert "text/html" in response.headers["Content-Type"]


def test_security_headers_are_present(client):
    response = client.get("/")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "same-origin"


# ---------------------------------------------------------------------------
# Public reference pages and the metadata that describes this deployment
# ---------------------------------------------------------------------------


def test_meta_describes_limits_and_languages(client):
    body = client.get("/api/meta").get_json()
    assert body["name"] == "Stow"
    assert body["limits"]["create"] > 0
    assert body["limits"]["window"] == 60
    assert "python" in body["languages"]
    assert body["slugLength"] == 7
    # The docs quote these, so every endpoint it documents must exist here.
    paths = {entry["path"] for entry in body["endpoints"]}
    assert "/api/pastes" in paths
    assert "/raw/{slug}" in paths


def test_health_reports_published_limits(client):
    body = client.get("/api/health").get_json()
    assert body["ok"] is True
    assert "limits" in body
    assert body["maxContentChars"] > 0


def test_create_rate_limit_fires_and_reports_retry_after(client):
    stow.RATE_CREATE.reset()
    limit = stow.RATE_CREATE.limit

    for _ in range(limit):
        assert make_paste(client).status_code == 201

    blocked = make_paste(client)
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers
    body = blocked.get_json()
    assert body["retryAfter"] >= 1
    assert "error" in body

    stow.RATE_CREATE.reset()


def test_read_and_create_quotas_are_separate(client):
    stow.RATE_CREATE.reset()
    stow.RATE_READ.reset()
    created = make_paste(client).get_json()

    # Exhaust the read quota, then confirm creating still works.
    for _ in range(stow.RATE_READ.limit):
        client.get(f"/api/pastes/{created['slug']}")
    assert client.get(f"/api/pastes/{created['slug']}").status_code == 429

    stow.RATE_CREATE.reset()
    assert make_paste(client).status_code == 201

    stow.RATE_READ.reset()
    stow.RATE_CREATE.reset()


def test_unlock_rate_limit_blunts_password_guessing(client):
    stow.RATE_UNLOCK.reset()
    created = make_paste(client, password="harbor-lamp").get_json()

    for _ in range(stow.RATE_UNLOCK.limit):
        client.post(f"/api/pastes/{created['slug']}/unlock", json={"password": "no"})

    blocked = client.post(
        f"/api/pastes/{created['slug']}/unlock", json={"password": "harbor-lamp"}
    )
    assert blocked.status_code == 429

    stow.RATE_UNLOCK.reset()


@pytest.mark.parametrize("path", ["/about", "/api", "/terms", "/privacy"])
def test_reference_pages_carry_their_own_metadata(client, path):
    response = client.get(path)
    assert response.status_code == 200
    page = response.get_data(as_text=True)
    assert 'property="og:title"' in page
    assert f'rel="canonical" href="{stow.BASE_URL}{path}"' in page
    # A public page must be indexable, unlike a paste.
    assert 'content="noindex' not in page


def test_unknown_document_route_returns_404_and_is_not_indexed(client):
    """An unknown path still renders the client, so the router can show its own
    404, but it must carry a real 404 status and a noindex tag: a soft 200 on a
    missing page invites crawlers to index every typo."""
    response = client.get("/nope-nope")
    assert response.status_code == 404
    page = response.get_data(as_text=True)
    assert 'content="noindex"' in page
    assert "<title>Nothing here - Stow</title>" in page


def test_reference_pages_are_indexable_while_pastes_are_not(client):
    created = make_paste(client).get_json()
    paste_page = client.get(f"/p/{created['slug']}").get_data(as_text=True)
    assert 'content="noindex' in paste_page
    assert 'content="noindex' not in client.get("/api").get_data(as_text=True)

