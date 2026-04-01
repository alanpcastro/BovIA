from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from .config import settings


def get_mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
    )


async def enviar_alerta_vacinacao(email_destino: str, fazenda: str, alertas: list[dict]) -> None:
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        return

    linhas = "\n".join(
        f"- Animal #{a['brinco']} ({a.get('nome') or 'sem nome'}): {a['descricao']} em {a['proxima_data']}"
        for a in alertas
    )

    body = f"""
Olá, {fazenda}!

Você tem {len(alertas)} vacinação(ões) prevista(s) nos próximos 7 dias:

{linhas}

Acesse o BovIA para mais detalhes: {settings.FRONTEND_URL}

— Equipe BovIA
"""

    message = MessageSchema(
        subject=f"BovIA — {len(alertas)} vacinação(ões) próxima(s)",
        recipients=[email_destino],
        body=body,
        subtype=MessageType.plain,
    )

    fm = FastMail(get_mail_config())
    await fm.send_message(message)
