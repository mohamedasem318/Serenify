"""LOCAL-ONLY replay regression: the real windows endpoint must reach a ``reading``.

This is the committed guard for the score-loop bug (the ``window_readings`` INSERT used
PostgREST's default ``return=representation``, whose ``INSERT … RETURNING`` read-back is
denied by the SELECT column whitelist — ``42501 permission denied for table
window_readings`` — 500-ing **every** scored/skipped window so no reading ever appeared).
The fix is ``insert_reading(..., returning=minimal)`` (see ``app/supabase_user.py``).

It replays the **real continuous device-gate fixtures** (the growing contiguous
recording-so-far at ~62/122/182/241/301 s) through the **real ASGI app** against **real
local Supabase**, signing in a seeded demo employee against **real GoTrue** to get a real
access token — no camera, no browser, no stubbed sub-calls. It asserts the sequence is all
``200`` (the regression was 500) and reaches a ``reading`` only after ``M=4`` scored windows.

It is **local-only and skips cleanly** when its prerequisites are absent (mirroring
``packages/ml-video/tests/test_tail_window.py`` assertion 3):
  * the continuous fixtures are **gitignored** (not in CI);
  * it needs a **running local Supabase** with the demo seed (``npm run seed``);
  * it reads the dev's local Supabase config from the standard env files.
The CI-runnable guards for the same bug are the fakes in ``test_inference_service.py`` /
``test_monitoring_endpoints.py`` (their ``window_readings`` insert rejects a representation
read-back, mirroring the real 42501).

The **service-role key is used only as harness scaffolding** to discover a seeded
employee's email; the endpoint path under test uses the **user token + anon key only**
(no service-role), exactly as production does.
"""

from __future__ import annotations

from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = (
    _REPO_ROOT / "packages" / "ml-video" / "tests" / "fixtures" / "continuous" / "chrome"
)
_FIXTURES = sorted(_FIXTURE_DIR.glob("recording-so-far_*.webm"))

_SHARED_DEMO_PASSWORD = "DemoUser123!"  # scripts/seed-demo.ts SHARED_PASSWORD (demo cohort)
_BANDS = {"at_ease", "a_little_tense", "tense"}


def _parse_env_file(path: Path) -> dict[str, str]:
    """Minimal KEY=VALUE reader (no deps); ignores blanks/comments. Returns {} if absent."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        out[key.strip()] = val.strip().strip('"').strip("'")
    return out


def _local_config() -> dict[str, str] | None:
    """The dev's local Supabase config from the standard env files, or None if incomplete.

    Cheap (file reads only — no network), so it is safe to evaluate at collection time for
    the module skip guard.
    """
    api_env = _parse_env_file(_REPO_ROOT / "apps" / "api" / ".env")
    web_env = _parse_env_file(_REPO_ROOT / "apps" / "web" / ".env.local")
    url = api_env.get("SUPABASE_URL") or web_env.get("NEXT_PUBLIC_SUPABASE_URL")
    anon = api_env.get("SUPABASE_ANON_KEY") or web_env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    secret = api_env.get("SUPABASE_JWT_SECRET")
    service_role = web_env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and anon and secret and service_role):
        return None
    return {"url": url, "anon": anon, "secret": secret, "service_role": service_role}


pytestmark = pytest.mark.skipif(
    not _FIXTURES or _local_config() is None,
    reason=(
        "continuous fixtures (gitignored) or local Supabase config absent — local-only "
        "replay; the CI guards are the representation-rejecting fakes in "
        "test_inference_service.py / test_monitoring_endpoints.py"
    ),
)


def _discover_employee_email(cfg: dict[str, str], httpx) -> str:
    """A seeded demo employee with a calibrated anchor. Service-role is SCAFFOLDING only
    (to look up the email) — never on the endpoint path under test."""
    svc = {"apikey": cfg["service_role"], "Authorization": f"Bearer {cfg['service_role']}"}
    rows = httpx.get(
        f"{cfg['url']}/rest/v1/profiles",
        params={
            "select": "id,role,anchor_captured_at",
            "role": "eq.employee",
            "anchor_captured_at": "not.is.null",
            "limit": "1",
        },
        headers=svc,
        timeout=10.0,
    ).json()
    if not rows:
        pytest.skip("no calibrated demo employee — run `npm run seed` against local Supabase")
    uid = rows[0]["id"]
    user = httpx.get(f"{cfg['url']}/auth/v1/admin/users/{uid}", headers=svc, timeout=10.0).json()
    return user["email"]


def _sign_in(cfg: dict[str, str], email: str, httpx) -> str:
    """Real GoTrue password grant → a real access token (exercises real JWT verification)."""
    resp = httpx.post(
        f"{cfg['url']}/auth/v1/token",
        params={"grant_type": "password"},
        json={"email": email, "password": _SHARED_DEMO_PASSWORD},
        headers={"apikey": cfg["anon"], "Content-Type": "application/json"},
        timeout=10.0,
    )
    if resp.status_code != 200:
        pytest.skip(f"demo employee sign-in failed ({resp.status_code}) — reseed local Supabase")
    return resp.json()["access_token"]


def test_replay_continuous_fixtures_reaches_a_reading():
    """warming_up ×3 → reading, end-to-end through the real endpoint + real Supabase.

    The core regression assertion is that **every** window returns ``200`` (the bug 500-ed
    them) and the sequence reaches a ``reading`` exactly when the 4th scored window lands."""
    import httpx
    from fastapi.testclient import TestClient

    from app.config import Settings, get_settings
    from app.main import create_app

    cfg = _local_config()
    assert cfg is not None  # guarded by pytestmark

    # Reachability + a seeded employee, else skip (Supabase down / not seeded).
    try:
        email = _discover_employee_email(cfg, httpx)
        token = _sign_in(cfg, email, httpx)
    except httpx.HTTPError as exc:
        pytest.skip(f"local Supabase not reachable: {exc!r}")

    # A real app whose REQUEST-path settings are the real local Supabase config, isolated to
    # this app instance via dependency_overrides (no global env / settings-cache mutation, so
    # the offline conftest placeholders other tests rely on are untouched).
    real_settings = Settings(
        supabase_jwt_secret=cfg["secret"],
        supabase_url=cfg["url"],
        supabase_anon_key=cfg["anon"],
        allowed_origins="http://localhost:3000",
    )
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: real_settings

    auth = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        created = client.post("/monitoring/sessions", headers=auth)
        assert created.status_code == 201, created.text
        session_id = created.json()["session_id"]

        outcomes: list[str] = []
        bodies: list[dict] = []
        for fixture in _FIXTURES:
            resp = client.post(
                f"/monitoring/sessions/{session_id}/windows",
                files={"clip": ("window.webm", fixture.read_bytes(), "video/webm")},
                headers=auth,
            )
            # THE regression: each window must be 200, never a 500 from the denied read-back.
            assert resp.status_code == 200, f"{fixture.name}: {resp.status_code} {resp.text}"
            body = resp.json()
            outcomes.append(body["outcome"])
            bodies.append(body)

    assert "reading" in outcomes, f"never reached a reading: {outcomes}"
    first_reading = outcomes.index("reading")
    # Cold-start: no band before M=4 scored windows. The proven device-gate fixtures all
    # score, so the first reading is the 4th window; nothing before it carries a band.
    assert outcomes[:first_reading] == ["warming_up"] * first_reading, outcomes
    assert first_reading >= 3, f"a band appeared before 4 scored windows: {outcomes}"
    reading = bodies[first_reading]
    assert reading["band"] in _BANDS
    assert "captured_at" in reading
