#!/usr/bin/env python3
\"\"\"Simple connectivity tests for OpenAI and SMTP using environment variables.
Usage: python scripts/test_connections.py
\"\"\"
import os
import smtplib
import sys
from email.message import EmailMessage

def test_openai():
    try:
        from openai import OpenAI
    except Exception as exc:
        print("OpenAI client not installed:", exc)
        return False
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        print("OPENAI_API_KEY not set")
        return False
    try:
        client = OpenAI(api_key=key)
        # lightweight request: model list or ping via responses with tiny prompt
        resp = client.responses.create(model=os.getenv("OPENAI_MODEL", "gpt-5-mini"), input=[{"role":"user","content":"say hi"}])
        print("OpenAI response received (truncated):", (resp.output_text or "")[:120])
        return True
    except Exception as exc:
        print("OpenAI request failed:", exc)
        return False

def test_smtp():
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    pwd = os.getenv("SMTP_PASSWORD")
    enable = os.getenv("SMTP_ENABLE", "false").lower() in ("1","true","yes")
    to_addr = user or os.getenv("TEST_SMTP_TO")
    if not enable:
        print("SMTP disabled (SMTP_ENABLE is false); skipping SMTP test")
        return True
    if not host or not to_addr:
        print("SMTP_HOST or recipient not configured")
        return False
    try:
        msg = EmailMessage()
        msg["From"] = os.getenv("SMTP_FROM", user)
        msg["To"] = to_addr
        msg["Subject"] = "Gharka Chef SMTP test"
        msg.set_content("This is a test email from Gharka Chef test script.")
        with smtplib.SMTP(host, port, timeout=10) as s:
            if os.getenv("SMTP_USE_TLS", "true").lower() in ("1","true","yes"):
                s.starttls()
            if user and pwd:
                s.login(user, pwd)
            s.send_message(msg)
        print("SMTP test email sent to", to_addr)
        return True
    except Exception as exc:
        print("SMTP test failed:", exc)
        return False

def main():
    ok1 = test_openai()
    ok2 = test_smtp()
    if ok1 and ok2:
        print("All tests passed")
        sys.exit(0)
    print("Some tests failed")
    sys.exit(2)

if __name__ == "__main__":
    main()

