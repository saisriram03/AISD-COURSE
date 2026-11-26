from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: str = "development"
    ENABLE_DEMO_MODE: bool = True
    DATABASE_URL: str = "sqlite:///./smartsched.db"
    JWT_SECRET_KEY: str = "smartsched-local-dev-secret-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_demo_allowed(self) -> bool:
        return self.APP_ENV.lower() == "development" and self.ENABLE_DEMO_MODE


@lru_cache
def get_settings() -> Settings:
    return Settings()
