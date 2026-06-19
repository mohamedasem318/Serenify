"""Service settings — env-only, no embedded secrets (Principle IX, DECISION-9).

Feature 008 (revised D-1) adds a **user-context** Supabase posture: the API talks
to PostgREST as the caller via the forwarded user JWT + the **publishable** anon
key. The anon key grants nothing beyond RLS, so it is NOT a secret — there is still
**no service-role key** anywhere in this service (strictly stronger than the
original D-1 service-role design; see plan.md Constitution Check Principle IX).
"""

from __future__ import annotations

import json
from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _operating_point_from_metadata() -> float:
    """The calibrated operating point, READ FROM MODEL METADATA — never a literal.

    Sourced from ``metadata.json`` at
    ``loso_metrics_60s_calibrated.threshold_sweep_recommended.threshold`` (0.53),
    the 60 s LOSO-calibrated block (Principle II; FR-012). This is the DEFAULT for
    ``STRESS_OPERATING_POINT``; an explicit env var still overrides it. The model
    package owns the metadata, so a re-calibration that ships a new threshold flows
    through automatically without touching this code (no hard-coded 0.53).
    """
    # Lazy import so the heavy ml_video package only loads when settings build
    # (it is imported by the app anyway), and so config has no import-time cost.
    from ml_video import models_dir

    meta = json.loads((models_dir() / "metadata.json").read_text(encoding="utf-8"))
    return float(meta["loso_metrics_60s_calibrated"]["threshold_sweep_recommended"]["threshold"])


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The HS256 secret for the LEGACY symmetric verification fallback (and the
    # unit tests). Required; no default — the service must not start blank.
    supabase_jwt_secret: str

    # Comma-separated web origins permitted by CORS (dev: http://localhost:3000).
    # List BOTH desktop-localhost and a LAN origin so device testing works without
    # re-toggling. Accepts ALLOWED_ORIGINS (preferred) or the legacy singular
    # ALLOWED_ORIGIN. Required. The raw string is normalised in `cors_origins`.
    allowed_origins: str = Field(
        validation_alias=AliasChoices("ALLOWED_ORIGINS", "ALLOWED_ORIGIN"),
    )

    # Base URL of the Supabase project (dev: http://127.0.0.1:54321). Used both to
    # fetch the JWKS public keys for asymmetric (ES256) access-token verification
    # AND, for feature 008, as the PostgREST base for the user-context client.
    # Now REQUIRED (feature 008 needs a DB endpoint, not just optional JWKS).
    supabase_url: str

    # Supabase PUBLISHABLE anon key — the SAME value shipped to browsers as
    # NEXT_PUBLIC_SUPABASE_ANON_KEY. Used as the PostgREST `apikey` alongside the
    # forwarded user JWT (revised D-1). It is RLS-respecting and grants nothing on
    # its own, so it is NOT a secret — and it is NOT the service-role key (which is
    # deliberately absent from this service). Required. Env: SUPABASE_ANON_KEY.
    supabase_anon_key: str

    # Calibrated operating point applied to predict_delta's proba[1] (the model's
    # internal 0.5 label is ignored for display; FR-012). Default is READ FROM
    # metadata.json (~0.53), never hard-coded; an env var overrides. Env:
    # STRESS_OPERATING_POINT.
    stress_operating_point: float = Field(default_factory=_operating_point_from_metadata)

    # Display-only band split: a-little-tense vs tense (D-3). The model carries no
    # metadata source for this (it has a single stress/not-stress operating point),
    # so it is a documented product default, tunable without retraining. Env:
    # STRESS_TENSE_BAND.
    stress_tense_band: float = 0.70

    # Log level for the service's own (`app`) and the `ml_video` package loggers
    # (see app.logging_config). apps/api ships no other logging config, so without
    # it ml_video's INFO records — notably the usable-face-coverage gate's
    # privacy-safe reject line (counts are server-log-only, never the wire —
    # Principle I) — are swallowed by the root WARNING default under uvicorn. INFO
    # surfaces that line; DEBUG additionally surfaces the decode-sampling
    # diagnostic. Server-side only. Env: LOG_LEVEL.
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        """Parsed CORS origins. The browser matches the Origin string EXACTLY, so
        each entry is trimmed and stripped of any trailing slash (a trailing slash
        was the dev CORS-rejection bug — http://localhost:3000/ never matches
        http://localhost:3000)."""
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
