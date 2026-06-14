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
            subject = data.get('subject')
            html_message = data.get('html_message')
            plain_message = data.get('plain_message')
            
            if not email or not subject or not (html_message or plain_message):
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"detail": "Email, subject, and message are required."}).encode('utf-8'))
                return

            smtp_user = "aicertificatemanagement@gmail.com"
            smtp_pass = "smcw pjdy qcqw hrjj"
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"FairShare <{smtp_user}>"
            msg['To'] = email
            
            if plain_message:
                msg.attach(MIMEText(plain_message, 'plain'))
            if html_message:
                msg.attach(MIMEText(html_message, 'html'))
            
            # Send using SMTP SSL on port 465
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, email, msg.as_string())

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": "Email sent successfully."}).encode('utf-8'))

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
