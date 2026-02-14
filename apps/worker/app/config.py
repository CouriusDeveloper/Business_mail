from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Microsoft Graph API
    azure_client_id: str = ""
    azure_client_secret: str = ""
    azure_tenant_id: str = ""

    # AI providers
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Worker settings
    polling_interval_seconds: int = 300  # 5 minutes fallback polling
    webhook_renewal_interval_hours: int = 48  # Renew webhooks every 2 days

    class Config:
        env_file = ".env"


settings = Settings()
