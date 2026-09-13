import os
import requests
from dotenv import load_dotenv

load_dotenv()

token = os.getenv("TELEGRAM_BOT_TOKEN")

if not token:
    print("TELEGRAM_BOT_TOKEN is missing from .env")
    raise SystemExit

url = f"https://api.telegram.org/bot{token}/getUpdates"

response = requests.get(
    url,
    timeout=10
)

data = response.json()

if not data.get("ok"):
    print("Telegram error:")
    print(data)
    raise SystemExit

updates = data.get("result", [])

if not updates:
    print("No messages found.")
    print("Open your bot in Telegram and send /start first.")
    raise SystemExit

for update in reversed(updates):
    message = update.get("message")

    if message:
        chat = message.get("chat", {})
        print("CHAT ID:", chat.get("id"))
        break