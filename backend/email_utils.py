import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

def send_password_reset_email(email: str, reset_link: str):
    """
    Sends a password reset email to the user.
    """
    if not all([SMTP_USER, SMTP_PASS]):
        print(f"DEBUG: Email credentials not set. Simulated Link: {reset_link}")
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = "Reset Your NexusAI Password"
    message["From"] = SMTP_FROM
    message["To"] = email

    # HTML Email Template
    html = f"""
    <html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0b; color: #ffffff; padding: 40px; text-align: center;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #141416; border: 1px solid #27272a; border-radius: 16px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h1 style="color: #6366f1; margin-bottom: 20px; font-weight: 800; letter-spacing: -0.025em;">Nexus<span style="color: #ffffff;">AI</span></h1>
            <h2 style="font-size: 24px; margin-bottom: 20px;">Reset your password</h2>
            <p style="color: #a1a1aa; line-height: 1.6; margin-bottom: 30px;">
                We received a request to reset your password. Click the button below to choose a new one. This link will expire in 15 minutes.
            </p>
            <a href="{reset_link}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; transition: background-color 0.2s;">
                Reset Password
            </a>
            <p style="color: #71717a; font-size: 13px; margin-top: 30px;">
                If you didn't request this, you can safely ignore this email.
            </p>
        </div>
    </body>
    </html>
    """

    part = MIMEText(html, "html")
    message.attach(part)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, email, message.as_string())
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
