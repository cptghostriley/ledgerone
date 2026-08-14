"""
Centralised email/SMTP helper for Quantive.
Uses Gmail SMTP SSL (port 465) with App Password credentials.
"""
import smtplib
import logging
from email.message import EmailMessage
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str, html: str | None = None) -> bool:
    """
    Send an email via SMTP SSL.
    Returns True on success, False on failure (never raises).
    """
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.smtp_user
        msg["To"] = to
        msg.set_content(body)
        if html:
            msg.add_alternative(html, subtype="html")

        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to}: {exc}")
        return False


def notify_admin_new_registration(firm_name: str, email: str) -> None:
    """Notify admin when a new firm registers."""
    send_email(
        to=settings.admin_email,
        subject=f"[Quantive] New firm registered: {firm_name}",
        body=(
            f"A new firm has registered on Quantive.\n\n"
            f"Firm name : {firm_name}\n"
            f"Owner email: {email}\n\n"
            f"Review and approve in the admin portal."
        ),
        html=(
            f"<h2>New Firm Registration — Quantive</h2>"
            f"<p><strong>Firm:</strong> {firm_name}</p>"
            f"<p><strong>Owner:</strong> {email}</p>"
            f"<p>Review in the <a href='http://localhost:3000/auth'>admin portal</a>.</p>"
        ),
    )


def send_otp_email(to: str, otp: str) -> bool:
    """Send OTP for admin login."""
    return send_email(
        to=to,
        subject="[Quantive] Your Admin Login OTP",
        body=f"Your Quantive Admin Login OTP is: {otp}\n\nIt is valid for a short time. Do not share it.",
        html=(
            f"<h2>Quantive — Admin OTP</h2>"
            f"<p>Your one-time password is:</p>"
            f"<h1 style='letter-spacing:8px;font-size:36px;'>{otp}</h1>"
            f"<p style='color:#888;font-size:12px;'>Valid for 10 minutes. Do not share with anyone.</p>"
        ),
    )
