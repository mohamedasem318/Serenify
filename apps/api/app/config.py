"""Service settings — env-only, no embedded secrets (Principle IX, DECISION-9)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The HS256 secret for the LEGACY symmetric verification fallback (and the
    # unit tests). Required; no default — the service must not start blank.
    supabase_jwt_secret: str

    # The web origin permitted by CORS (dev: http://localhost:3000). Required.
    allowed_origin: str

    # Base URL of the Supabase project (dev: http://127.0.0.1:54321). Used to
    # fetch the JWKS public keys for asymmetric (ES256) access-token verification
    # — the default signing mode of current Supabase (local CLI + cloud). Optional:
    # when unset the verifier is HS256-only (legacy projects / unit-test default).
    supabase_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
