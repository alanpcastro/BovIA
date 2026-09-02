from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    FRONTEND_URL: str = "http://localhost:5173"

    # Brevo (API HTTP) — motor de envio principal. O Render bloqueia SMTP de saída,
    # então enviamos via HTTPS. Só precisa da API key + um remetente verificado no Brevo.
    BREVO_API_KEY: str = ""

    MAIL_USERNAME: str = ""       # também serve de remetente (verifique-o no Brevo)
    MAIL_PASSWORD: str = ""       # usado só no fallback SMTP (dev local)
    MAIL_FROM: str = ""           # remetente; se vazio, cai pro MAIL_USERNAME
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_PORT: int = 587

    class Config:
        env_file = ".env"


settings = Settings()
