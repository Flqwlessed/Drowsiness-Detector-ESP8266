import os
import requests
from dotenv import load_dotenv

load_dotenv()

token = os.getenv("TELEGRAM_BOT_TOKEN")
chat_id = os.getenv("TELEGRAM_CHAT_ID")

if not token:
    print("Bot token missing")
    raise SystemExit

if not chat_id:
    print("Chat ID missing")
    raise SystemExit

message = """
🚨 DRIVER GUARD TEST

Telegram notification system is working.

Student project simulation only.
"""

url = f"https://api.telegram.org/bot{token}/sendMessage"

response = requests.post(
    url,
    json={
        "chat_id": chat_id,
        "text": message
    },
    timeout=10
)

data = response.json()

if data.get("ok"):
    print("TELEGRAM MESSAGE SENT ✓")
else:
    print("TELEGRAM ERROR:")
    print(data)