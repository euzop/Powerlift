"""
Email service for PowerLift.
Handles sending verification emails and other notifications.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import datetime
import sys
import importlib.util
from pathlib import Path

# Try to import config
try:
    # Add parent directory to path to import config
    parent_dir = str(Path(__file__).resolve().parent.parent)
    if parent_dir not in sys.path:
        sys.path.append(parent_dir)
    
    # Try to import config
    try:
        from config import EMAIL_CONFIG
        # Email configuration from config file
        EMAIL_HOST = EMAIL_CONFIG.get('EMAIL_HOST', 'smtp.gmail.com')
        EMAIL_PORT = EMAIL_CONFIG.get('EMAIL_PORT', 587)
        EMAIL_USE_TLS = EMAIL_CONFIG.get('EMAIL_USE_TLS', True)
        EMAIL_HOST_USER = EMAIL_CONFIG.get('EMAIL_HOST_USER', '')
        EMAIL_HOST_PASSWORD = EMAIL_CONFIG.get('EMAIL_HOST_PASSWORD', '')
        DEFAULT_FROM_EMAIL = EMAIL_CONFIG.get('DEFAULT_FROM_EMAIL', 'powerlift@example.com')
        
        print(f"Email configuration loaded from config.py")
    except ImportError:
        # Fallback to environment variables
        EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
        EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
        EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'
        EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
        EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
        DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'powerlift@example.com')
        
        print(f"Email configuration loaded from environment variables")
except Exception as e:
    print(f"Error loading email configuration: {str(e)}")
    # Default configuration
    EMAIL_HOST = 'smtp.gmail.com'
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = ''
    EMAIL_HOST_PASSWORD = ''
    DEFAULT_FROM_EMAIL = 'powerlift@example.com'

def send_email(to_email, subject, html_content, from_email=None):
    """
    Send an email with the given parameters.
    
    Args:
        to_email (str): Recipient email address
        subject (str): Email subject
        html_content (str): HTML content of the email
        from_email (str, optional): Sender email address. Defaults to DEFAULT_FROM_EMAIL.
    
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
        print("WARNING: Email credentials not set. Email not sent.")
        print("Please update the config.py file with your email credentials.")
        return False
    
    from_email = from_email or DEFAULT_FROM_EMAIL
    
    # Create message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = from_email
    msg['To'] = to_email
    
    # Attach HTML content
    html_part = MIMEText(html_content, 'html')
    msg.attach(html_part)
    
    try:
        # Connect to server and send email
        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
        if EMAIL_USE_TLS:
            server.starttls()
        
        server.login(EMAIL_HOST_USER, EMAIL_HOST_PASSWORD)
        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()
        
        print(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        return False

def send_verification_email(to_email, username, verification_url):
    """
    Send verification email to user.
    
    Args:
        to_email (str): User's email address
        username (str): User's username
        verification_url (str): URL for email verification
    
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    subject = "PowerLift - Verify Your Email Address"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333333;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                background-color: #FF3B4E;
                color: white;
                padding: 20px;
                text-align: center;
            }}
            .content {{
                padding: 20px;
                background-color: #f9f9f9;
            }}
            .button {{
                display: inline-block;
                background-color: #FF3B4E;
                color: white;
                text-decoration: none;
                padding: 10px 20px;
                margin: 20px 0;
                border-radius: 5px;
            }}
            .footer {{
                margin-top: 20px;
                text-align: center;
                font-size: 12px;
                color: #666666;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>PowerLift</h1>
            </div>
            <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Hello {username},</p>
                <p>Thank you for signing up for PowerLift! To complete your registration, please verify your email address by clicking the button below:</p>
                <p style="text-align: center;">
                    <a href="{verification_url}" class="button">Verify Email</a>
                </p>
                <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
                <p>{verification_url}</p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create an account with PowerLift, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>&copy; {datetime.datetime.now().year} PowerLift. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(to_email, subject, html_content) 