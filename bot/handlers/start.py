from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.filters import Command

from database.db import add_user, check_subscription
from config import MINI_APP_URL

router = Router()

@router.message(Command("start"))
async def cmd_start(message: Message):
    """Handle /start command"""
    user = message.from_user
    
    # Save user to database
    await add_user(
        user_id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name
    )
    
    # Check subscription status
    sub_status = await check_subscription(user.id)
    
    # Create keyboard
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="📚 TrendoSpeak - O'rganish",
            web_app=WebAppInfo(url=MINI_APP_URL)
        )],
        [InlineKeyboardButton(
            text="💎 Premium obuna",
            callback_data="subscribe"
        )],
        [InlineKeyboardButton(
            text="📊 Obuna holati",
            callback_data="status"
        )]
    ])
    
    # Welcome message
    if sub_status["has_subscription"]:
        status_text = f"✅ Premium obuna faol ({sub_status['days_left']} kun qoldi)"
    else:
        status_text = "🆓 Bepul tarif (faqat 1-dars)"
    
    welcome_text = f"""
🎓 *TrendoSpeak - Ingliz Tili O'rganish*

Salom, {user.first_name}! 👋

Men sizga ingliz tilini o'rganishda yordam beraman. Har bir darsda yangi so'zlar va ularni to'g'ri talaffuz qilishni o'rganasiz.

📌 *Sizning holatngiz:* {status_text}

⬇️ Boshlash uchun tugmani bosing:
"""
    
    await message.answer(
        welcome_text,
        reply_markup=keyboard,
        parse_mode="Markdown"
    )

@router.callback_query(F.data == "status")
async def show_status(callback: CallbackQuery):
    """Show subscription status"""
    sub_status = await check_subscription(callback.from_user.id)
    
    if sub_status["has_subscription"]:
        text = f"""
✅ *Premium Obuna Faol*

📅 Tarif: {sub_status['plan'].capitalize()}
⏳ Tugash sanasi: {sub_status['end_date'][:10]}
📆 Qolgan kunlar: {sub_status['days_left']}

Barcha 10 ta darsdan foydalanishingiz mumkin!
"""
    else:
        text = """
🆓 *Bepul Tarif*

Hozirda faqat 1-darsdan foydalanishingiz mumkin.

💎 Premium obuna olish uchun "Premium obuna" tugmasini bosing.
"""
    
    await callback.answer()
    await callback.message.answer(text, parse_mode="Markdown")
