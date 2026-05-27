"""Service settings — env-only, no embedded secrets (Principle IX, DECISION-9)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The HS256 secret used to sign Supabase access tokens. Required; no default —
    # the service must not start with a missing/blank JWT secret.
    supabase_jwt_secret: str

    # The web origin permitted by CORS (dev: http://127.0.0.1:3000). Required.
    allowed_origin: str


@lru_cache
def get_settings() -> Settings:
    return Settings()
