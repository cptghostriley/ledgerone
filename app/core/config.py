from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "CA Intelligence"
    app_version: str = "0.1.0"
    debug: bool = False
    secret_key: str
    database_url: str
    database_pool_size: int = 10
    redis_url: str
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma4:e4b"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_timeout: int = 120
    ollama_max_retries: int = 3
    storage_path: str = "/app/storage"
    max_file_size_mb: int = 50
    max_pages_per_doc: int = 100
    audio_chunk_seconds: int = 30
    pdf_dpi: int = 150
    embedding_dim: int = 768
    jwt_secret: str
    jwt_expire_minutes: int = 1440
    celery_workers: int = 1
    reconciliation_cache_ttl: int = 3600
    allowed_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
