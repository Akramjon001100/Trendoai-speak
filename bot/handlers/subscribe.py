from aiogram import Router, F
from aiogram.types import (
    CallbackQuery, 
    Message,
    LabeledPrice, 
    PreCheckoutQuery,
    InlineKeyboardMarkup, 
    InlineKeyboardButton
)

from database.db import add_subscription, check_subscription
from config import PRICES

router = Router()

@router.callback_query(F.data == "subscribe")
async def show_plans(callback: CallbackQuery):
    """Show subscription plans"""
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=f"📅 Haftalik - {PRICES['weekly']} ⭐",
            callback_data="buy_weekly"
        )],
        [InlineKeyboardButton(
            text=f"📆 Oylik - {PRICES['monthly']} ⭐ (Tejamkor!)",
            callback_data="buy_monthly"
        )],
        [InlineKeyboardButton(
            text="🔙 Orqaga",
            callback_data="back_to_start"
        )]
    ])
    
    text = """
💎 *Premium Obuna Tariflari*

Premium obuna bilan siz:
✅ Barcha 10 ta darsdan foydalanasiz
✅ PDF formatda yuklab olasiz
✅ AI bilan jonli suhbat qilasiz

*Tariflar:*

📅 *Haftalik* - {weekly} ⭐ Stars
   └ 7 kun to'liq foydalanish

📆 *Oylik* - {monthly} ⭐ Stars (Tejamkor!)
   └ 30 kun to'liq foydalanish

⬇️ Tanlang:
""".format(weekly=PRICES['weekly'], monthly=PRICES['monthly'])
    
    await callback.answer()
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode="Markdown")

@router.callback_query(F.data == "buy_weekly")
async def buy_weekly(callback: CallbackQuery):
    """Send invoice for weekly subscription"""
    await send_stars_invoice(callback, "weekly", PRICES['weekly'], 7)

@router.callback_query(F.data == "buy_monthly")
async def buy_monthly(callback: CallbackQuery):
    """Send invoice for monthly subscription"""
    await send_stars_invoice(callback, "monthly", PRICES['monthly'], 30)

async def send_stars_invoice(callback: CallbackQuery, plan: str, stars: int, days: int):
    """Send Telegram Stars payment invoice"""
    await callback.answer()
    
    title = f"TrendoSpeak Premium - {plan.capitalize()}"
    description = f"{days} kunlik premium obuna. Barcha 10 ta darsdan foydalaning!"
    
    prices = [LabeledPrice(label=title, amount=stars)]
    
    await callback.message.answer_invoice(
        title=title,
        description=description,
        payload=f"subscription_{plan}_{days}",
        currency="XTR",  # Telegram Stars currency code
        prices=prices,
        start_parameter=f"subscribe_{plan}"
    )

@router.pre_checkout_query()
async def pre_checkout(query: PreCheckoutQuery):
    """Handle pre-checkout - always approve for Stars"""
    await query.answer(ok=True)

@router.message(F.successful_payment)
async def successful_payment(message: Message):
    """Handle successful payment"""
    payment = message.successful_payment
    payload = payment.invoice_payload
    
    # Parse payload: subscription_weekly_7 or subscription_monthly_30
    parts = payload.split("_")
    plan = parts[1]
    days = int(parts[2])
    stars = payment.total_amount
    
    # Save subscription to database
    await add_subscription(
        user_id=message.from_user.id,
        plan=plan,
        stars_paid=stars,
        days=days,
        payment_id=payment.telegram_payment_charge_id
    )
    
    # Send confirmation
    text = f"""
🎉 *To'lov muvaffaqiyatli!*

✅ Siz {plan.capitalize()} obunani sotib oldingiz
📅 Amal qilish muddati: {days} kun
💎 To'langan: {stars} ⭐ Stars

Endi barcha 10 ta darsdan foydalanishingiz mumkin!

/start - Bosh menyuga qaytish
"""
    
    await message.answer(text, parse_mode="Markdown")

@router.callback_query(F.data == "back_to_start")
async def back_to_start(callback: CallbackQuery):
    """Go back to start menu"""
    from handlers.start import cmd_start
    await callback.answer()
    await callback.message.delete()
    await cmd_start(callback.message)
