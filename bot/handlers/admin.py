from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command

from database.db import get_all_users_count, get_active_subscriptions_count
from config import ADMIN_IDS

router = Router()

def is_admin(user_id: int) -> bool:
    """Check if user is admin"""
    return user_id in ADMIN_IDS

@router.message(Command("admin"))
async def admin_panel(message: Message):
    """Show admin panel"""
    if not is_admin(message.from_user.id):
        await message.answer("⛔ Sizda admin huquqi yo'q!")
        return
    
    users_count = await get_all_users_count()
    subs_count = await get_active_subscriptions_count()
    
    text = f"""
👨‍💼 *Admin Panel*

📊 *Statistika:*
👥 Jami foydalanuvchilar: {users_count}
💎 Faol obunalar: {subs_count}

*Buyruqlar:*
/broadcast [matn] - Xabar yuborish
/stats - Batafsil statistika
"""
    
    await message.answer(text, parse_mode="Markdown")

@router.message(Command("stats"))
async def show_stats(message: Message):
    """Show detailed statistics"""
    if not is_admin(message.from_user.id):
        return
    
    users_count = await get_all_users_count()
    subs_count = await get_active_subscriptions_count()
    
    text = f"""
📊 *Batafsil Statistika*

👥 Jami foydalanuvchilar: {users_count}
💎 Faol Premium obunalar: {subs_count}
🆓 Bepul foydalanuvchilar: {users_count - subs_count}

📈 Konversiya: {(subs_count/users_count*100) if users_count > 0 else 0:.1f}%
"""
    
    await message.answer(text, parse_mode="Markdown")
