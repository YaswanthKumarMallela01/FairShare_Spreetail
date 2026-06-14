import json
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            # Verify shared secret to prevent abuse
            secret = self.headers.get('X-Fairshare-Secret') or data.get('secret')
            if secret != "fairshare-secure-otp-transfer-key-2026":
                self.send_response(403)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "Forbidden: Invalid secret key."}).encode('utf-8'))
                return
                
            email = data.get('email')
            otp = data.get('otp')
            if not email or not otp:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "Email and OTP are required."}).encode('utf-8'))
                return

            smtp_user = "aicertificatemanagement@gmail.com"
            smtp_pass = "smcw pjdy qcqw hrjj"
            
            subject = "Reset Your FairShare Password"
            
            # HTML message
            html_message = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                <div style="text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 28px;">
                    <h1 style="color: #0f172a; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">FairShare</h1>
                    <p style="color: #64748b; font-size: 14px; margin: 6px 0 0 0; font-weight: 500;">Shared expense tracking made simple</p>
                </div>
                
                <p style="color: #334155; font-size: 16px; margin: 0 0 16px 0; font-weight: 500;">Hello,</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">We received a request to reset the password for your FairShare account. Please use the following One-Time Password (OTP) to complete the verification process:</p>
                
                <div style="text-align: center; margin: 32px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #2563eb; font-family: 'Courier New', Courier, monospace;">{otp}</span>
                </div>
                
                <p style="color: #dc2626; font-size: 13px; font-weight: 600; margin: 0 0 24px 0;">⚠️ This OTP code is valid for 10 minutes. Do not share this email or code with anyone.</p>
                
                <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 28px 0 0 0; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                    If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
                
                <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 36px; margin-bottom: 0;">
                    &copy; 2026 FairShare. All rights reserved.
                </p>
            </div>
            """
            
            plain_message = (
                f"Hello,\n\n"
                f"We received a request to reset your FairShare password. "
                f"Your One-Time Password (OTP) code is:\n\n"
                f"{otp}\n\n"
                f"This code is valid for 10 minutes. Do not share this code with anyone.\n\n"
                f"If you did not request a password reset, you can safely ignore this email.\n\n"
                f"Best regards,\n"
                f"FairShare Team"
            )

            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"FairShare <{smtp_user}>"
            msg['To'] = email
            
            msg.attach(MIMEText(plain_message, 'plain'))
            msg.attach(MIMEText(html_message, 'html'))
            
            # Send using SMTP SSL on port 465
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, email, msg.as_string())

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": "OTP email sent successfully."}).encode('utf-8'))

        except Exception as e:
            import traceback
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "detail": "Failed to send email via Vercel serverless.",
                "error": str(e),
                "traceback": traceback.format_exc()
            }).encode('utf-8'))
