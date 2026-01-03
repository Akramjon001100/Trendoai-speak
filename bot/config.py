import os
from dotenv import load_dotenv

load_dotenv()

# Bot token from BotFather
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# Admin user IDs (comma separated)
ADMIN_IDS = [int(x) for x in os.getenv("ADMIN_IDS", "").split(",") if x]

# Mini App URL
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://trendoaispeak-uzbek-english-tutor-l7lec74rp.vercel.app")

# Subscription prices in Telegram Stars
PRICES = {
    "weekly": 50,   # 50 Stars ~ $1
    "monthly": 150  # 150 Stars ~ $3
}

# Database path
DATABASE_PATH = "bot/database/trendospeak.db"
