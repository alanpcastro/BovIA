import logging

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from .config import settings

logger = logging.getLogger(__name__)


def get_mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        # Sem MAIL_FROM configurado, usa o próprio usuário (Gmail exige remetente = conta).
        # Evita quebrar o envio quando só MAIL_USERNAME/MAIL_PASSWORD foram setados.
        MAIL_FROM=settings.MAIL_FROM or settings.MAIL_USERNAME,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
    )


async def enviar_reset_senha(email_destino: str, nome: str, link: str) -> None:
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning(
            "Reset de senha solicitado para %s, mas MAIL_USERNAME/MAIL_PASSWORD "
            "não estão configurados — nenhum email foi enviado.",
            email_destino,
        )
        return

    body = f"""
Ola, {nome}!

Voce solicitou a redefinicao de senha no BovIA.

Clique no link abaixo para criar uma nova senha:

{link}

Este link expira em 30 minutos.

Se voce nao solicitou essa alteracao, ignore este email.

— Equipe BovIA
"""

    message = MessageSchema(
        subject="BovIA — Redefinicao de Senha",
        recipients=[email_destino],
        body=body,
        subtype=MessageType.plain,
    )

    try:
        fm = FastMail(get_mail_config())
        await fm.send_message(message)
    except Exception:
        # Roda em BackgroundTask: sem log, a falha (credencial errada, SMTP fora)
        # sumiria silenciosamente e o usuário nunca receberia o link.
        logger.exception("Falha ao enviar email de reset de senha para %s", email_destino)


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
