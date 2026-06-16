"""Service settings — env-only, no embedded secrets (Principle IX, DECISION-9)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Base URL of the Supabase project (dev: http://127.0.0.1:54321). Used to
    # fetch the JWKS public keys for asymmetric (ES256) access-token verification
    # — the default signing mode of current Supabase (local CLI + cloud). Optional:
    # when unset the verifier is HS256-only (legacy projects / unit-test default).
    supabase_url: str | None = None

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
