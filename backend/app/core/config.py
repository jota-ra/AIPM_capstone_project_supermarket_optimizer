from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


# backend/app/core/config.py
BASE_DIR = Path(__file__).resolve().parents[3]  # -> repo root


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str

    # E1 auth. User access tokens are verified in services/auth.py. The
    # project uses Supabase's asymmetric signing keys (verified via the
    # JWKS endpoint derived from SUPABASE_URL), so SUPABASE_JWT_SECRET is
    # only needed as a fallback for legacy HS256 tokens — optional.
    SUPABASE_JWT_SECRET: str = ""

    # Nutri-Coach LLM (services/nutri_coach.py). When False, the warm coach
    # message is always the rule-based template and Gemini is never called
    # — useful for local dev (no key / free-tier quota) and offline demos.
    # Defaults True to preserve production behaviour; set
    # COACH_LLM_ENABLED=false in .env to turn it off.
    COACH_LLM_ENABLED: bool = True

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        extra="ignore"
    )


settings = Settings()