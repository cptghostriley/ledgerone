from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Quantive"
    app_version: str = "0.1.0"
    debug: bool = False
    secret_key: str
    database_url: str
    database_pool_size: int = 10
    redis_url: str = "redis://localhost:6379/0"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma4:e2b"
    ollama_qna_model: str = "qwen2.5:3b-instruct"
    ollama_embedding_model: str = "nomic-embed-text"
    ollama_timeout: int = 120
    ollama_max_retries: int = 3
    storage_path: str = "./storage"
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
    # S3 Object Storage settings
    use_s3: bool = False
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    s3_bucket_name: str = ""
    # SMTP / Mail settings
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: str = "workstudiotwelve@gmail.com"
    smtp_password: str = ""
    admin_email: str = "workstudiotwelve@gmail.com"
    vite_google_client_id: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()

