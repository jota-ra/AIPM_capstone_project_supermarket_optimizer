from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


# backend/app/core/config.py
BASE_DIR = Path(__file__).resolve().parents[3]  # -> repo root


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        extra="ignore"
    )


settings = Settings()