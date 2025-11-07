"""
Test script to verify email configuration.
"""

from backend.email_service import send_email

def test_email_config():
    """Test email configuration by sending a test email."""
    recipient = input("Enter recipient email address: ")
    
    print("\nSending test email...")
    result = send_email(
        to_email=recipient,
        subject="PowerLift Email Test",
        html_content="""
        <html>
        <body>
            <h1>PowerLift Email Test</h1>
            <p>This is a test email from PowerLift to verify your email configuration.</p>
            <p>If you received this email, your email configuration is working correctly!</p>
        </body>
        </html>
        """
    )
    
    if result:
        print("\nSuccess! Test email sent successfully.")
        print("Your email configuration is working correctly.")
    else:
        print("\nFailed to send test email.")
        print("Please check your email configuration in config.py.")

if __name__ == "__main__":
    print("PowerLift Email Configuration Test")
    print("=================================\n")
    test_email_config() 