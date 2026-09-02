import logging

import httpx
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from .config import settings

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def get_mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        # Sem MAIL_FROM configurado, usa o próprio usuário (Gmail exige remetente = conta).
        MAIL_FROM=settings.MAIL_FROM or settings.MAIL_USERNAME,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
    )


def _remetente() -> str:
    """E-mail remetente. No Brevo precisa ser um remetente verificado."""
    return settings.MAIL_FROM or settings.MAIL_USERNAME


async def _enviar_email(destino: str, nome: str, assunto: str, corpo: str) -> None:
    """Envia um e-mail de texto. Motor principal: Brevo (API HTTP, funciona no Render).
    Fallback: SMTP via fastapi-mail (útil no dev local). Nunca levanta exceção —
    roda em BackgroundTask, então falhas só viram log."""
    remetente = _remetente()

    # ── Motor principal: Brevo (HTTPS, não é bloqueado pelo Render) ──
    if settings.BREVO_API_KEY and remetente:
        payload = {
            "sender": {"name": "BovIA", "email": remetente},
            "to": [{"email": destino, "name": nome or destino}],
            "subject": assunto,
            "textContent": corpo,
        }
        headers = {
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json",
            "accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(BREVO_API_URL, json=payload, headers=headers)
            if resp.status_code >= 400:
                logger.error(
                    "Brevo recusou o envio para %s: HTTP %s — %s",
                    destino, resp.status_code, resp.text,
                )
        except Exception:
            logger.exception("Falha ao enviar email (Brevo) para %s", destino)
        return

    # ── Fallback: SMTP (dev local; no Render costuma dar timeout) ──
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning(
            "Email para %s não enviado: nem BREVO_API_KEY nem MAIL_USERNAME/"
            "MAIL_PASSWORD estão configurados.",
            destino,
        )
        return

    message = MessageSchema(
        subject=assunto,
        recipients=[destino],
        body=corpo,
        subtype=MessageType.plain,
    )
    try:
        fm = FastMail(get_mail_config())
        await fm.send_message(message)
    except Exception:
        logger.exception("Falha ao enviar email (SMTP) para %s", destino)


async def enviar_reset_senha(email_destino: str, nome: str, link: str) -> None:
    corpo = f"""
Ola, {nome}!

Voce solicitou a redefinicao de senha no BovIA.

Clique no link abaixo para criar uma nova senha:

{link}

Este link expira em 30 minutos.

Se voce nao solicitou essa alteracao, ignore este email.

— Equipe BovIA
"""
    await _enviar_email(email_destino, nome, "BovIA — Redefinicao de Senha", corpo)


async def enviar_alerta_vacinacao(email_destino: str, fazenda: str, alertas: list[dict]) -> None:
    linhas = "\n".join(
        f"- Animal #{a['brinco']} ({a.get('nome') or 'sem nome'}): {a['descricao']} em {a['proxima_data']}"
        for a in alertas
    )
    corpo = f"""
Olá, {fazenda}!

Você tem {len(alertas)} vacinação(ões) prevista(s) nos próximos 7 dias:

{linhas}

Acesse o BovIA para mais detalhes: {settings.FRONTEND_URL}

— Equipe BovIA
"""
    await _enviar_email(
        email_destino, fazenda,
        f"BovIA — {len(alertas)} vacinação(ões) próxima(s)", corpo,
    )
