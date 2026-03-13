from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    app_name: str = "Gharka Chef API"
    # Allow common local dev origins so browser preflight requests succeed.
    cors_allow_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3005",
        "http://localhost:3006",
    ]
    use_postgresql: bool = True
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "gharka_chef"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres123"
    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_image_model: str = "gpt-image-1"
    # Groq (OpenAI-compatible) configuration
    groq_api_key: str = Field("", env=("GROQ_API_KEY", "groq_api_key"))
    groq_base_url: str = Field("https://api.groq.com/openai/v1", env=("GROQ_BASE_URL", "groq_base_url"))
    groq_model: str = Field("llama-3.1-8b-instant", env=("GROQ_MODEL", "groq_model"))
    # LLM provider configuration: allow selecting which provider to use for recipe generation
    llm_providers: list[str] = ["openai", "ollama", "groq"]
    default_llm_provider: str = "ollama"
    # Ollama models available locally (if ollama is installed).
    # Removed llava models from the selectable list due to instability on some hosts.
    ollama_models: list[str] = ["phi3:latest", "mistral:latest", "llama3.1:latest"]
    # Default to llama3.1 latest as requested
    default_ollama_model: str = "llama3.1:latest"
    # Groq models available for testing (OpenAI-compatible)
    groq_models: list[str] = ["llama-3.1-8b-instant"]
    # Optional Ollama HTTP API base URL (for local Ollama server streaming)
    ollama_http_url: str | None = Field("http://localhost:11434", env=("OLLAMA_HTTP_URL", "ollama_http_url"))
    # SMTP / Email settings (accept common legacy env names as aliases)
    smtp_enable: bool = Field(False, env=("SMTP_ENABLE", "email_enabled", "EMAIL_ENABLED"))
    smtp_host: str | None = Field(None, env=("SMTP_HOST", "smtp_host", "SMTP_HOSTNAME"))
    smtp_port: int = Field(587, env=("SMTP_PORT", "smtp_port"))
    smtp_user: str | None = Field(None, env=("SMTP_USER", "smtp_user"))
    smtp_password: str | None = Field(None, env=("SMTP_PASSWORD", "smtp_password"))
    smtp_from: str = Field("no-reply@gharkachef.local", env=("SMTP_FROM", "from_email", "FROM_EMAIL"))
    smtp_use_tls: bool = Field(True, env=("SMTP_USE_TLS", "smtp_use_tls"))
    # Developer helper: return generated OTP in API response (dev only)
    dev_return_otp_in_response: bool = Field(True, env=("DEV_RETURN_OTP_IN_RESPONSE", "DEV_RETURN_OTP", "RETURN_OTP_IN_RESPONSE"))
    # YouTube API key for backend YouTube service (optional)
    youtube_api_key: str | None = Field(None, env=("YOUTUBE_API_KEY", "youtube_api_key"))
    # Redis URL for pub/sub (used for SSE push)
    redis_url: str = Field("redis://localhost:6379/0", env=("REDIS_URL", "redis_url"))

    # Use model_config to read .env and ignore unknown keys (legacy names)
    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
