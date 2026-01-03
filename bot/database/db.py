import aiosqlite
from datetime import datetime, timedelta
from config import DATABASE_PATH

async def init_db():
    """Initialize database tables"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        ''')
        
        await db.execute('''
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan TEXT NOT NULL,
                stars_paid INTEGER NOT NULL,
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                payment_id TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')
        
        await db.commit()

async def add_user(user_id: int, username: str = None, first_name: str = None, last_name: str = None):
    """Add or update user"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute('''
            INSERT INTO users (user_id, username, first_name, last_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                first_name = excluded.first_name,
                last_name = excluded.last_name
        ''', (user_id, username, first_name, last_name))
        await db.commit()

async def get_user(user_id: int):
    """Get user by ID"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute('SELECT * FROM users WHERE user_id = ?', (user_id,)) as cursor:
            return await cursor.fetchone()

async def add_subscription(user_id: int, plan: str, stars_paid: int, days: int, payment_id: str = None):
    """Add new subscription"""
    end_date = datetime.now() + timedelta(days=days)
    
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Deactivate old subscriptions
        await db.execute('''
            UPDATE subscriptions SET is_active = 0 WHERE user_id = ?
        ''', (user_id,))
        
        # Add new subscription
        await db.execute('''
            INSERT INTO subscriptions (user_id, plan, stars_paid, end_date, payment_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, plan, stars_paid, end_date, payment_id))
        await db.commit()

async def get_active_subscription(user_id: int):
    """Get user's active subscription"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute('''
            SELECT * FROM subscriptions 
            WHERE user_id = ? AND is_active = 1 AND end_date > datetime('now')
            ORDER BY end_date DESC LIMIT 1
        ''', (user_id,)) as cursor:
            return await cursor.fetchone()

async def check_subscription(user_id: int) -> dict:
    """Check if user has active subscription"""
    sub = await get_active_subscription(user_id)
    if sub:
        return {
            "has_subscription": True,
            "plan": sub["plan"],
            "end_date": sub["end_date"],
            "days_left": (datetime.fromisoformat(sub["end_date"]) - datetime.now()).days
        }
    return {
        "has_subscription": False,
        "plan": None,
        "end_date": None,
        "days_left": 0
    }

async def get_all_users_count():
    """Get total users count"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('SELECT COUNT(*) FROM users') as cursor:
            result = await cursor.fetchone()
            return result[0] if result else 0

async def get_active_subscriptions_count():
    """Get active subscriptions count"""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.execute('''
            SELECT COUNT(*) FROM subscriptions 
            WHERE is_active = 1 AND end_date > datetime('now')
        ''') as cursor:
            result = await cursor.fetchone()
            return result[0] if result else 0
