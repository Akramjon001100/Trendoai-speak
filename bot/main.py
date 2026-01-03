import asyncio
import logging
from aiohttp import web

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties

from config import BOT_TOKEN
from database.db import init_db, check_subscription
from handlers import start, subscribe, admin

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize bot and dispatcher
bot = Bot(
    token=BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN)
)
dp = Dispatcher()

# ==================== API Endpoints ====================

async def check_user_subscription(request):
    """API endpoint to check user subscription status"""
    try:
        user_id = int(request.match_info.get('user_id', 0))
        if not user_id:
            return web.json_response({"error": "user_id required"}, status=400)
        
        status = await check_subscription(user_id)
        return web.json_response(status)
    except Exception as e:
        logger.error(f"Error checking subscription: {e}")
        return web.json_response({"error": str(e)}, status=500)

async def health_check(request):
    """Health check endpoint"""
    return web.json_response({"status": "ok", "bot": "TrendoSpeak"})

# ==================== Main ====================

async def on_startup():
    """Initialize on startup"""
    await init_db()
    logger.info("Database initialized")
    logger.info("Bot started successfully!")

async def on_shutdown():
    """Cleanup on shutdown"""
    await bot.session.close()
    logger.info("Bot stopped")

async def start_web_server():
    """Start aiohttp web server for API"""
    app = web.Application()
    app.router.add_get('/api/subscription/{user_id}', check_user_subscription)
    app.router.add_get('/health', health_check)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    await site.start()
    logger.info("API server started on port 8080")

async def main():
    """Main function"""
    # Register routers
    dp.include_router(start.router)
    dp.include_router(subscribe.router)
    dp.include_router(admin.router)
    
    # Setup
    await on_startup()
    
    # Start API server
    await start_web_server()
    
    # Start polling
    try:
        await dp.start_polling(bot, skip_updates=True)
    finally:
        await on_shutdown()

if __name__ == "__main__":
    asyncio.run(main())
