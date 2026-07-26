import time
from datetime import date
from sqlalchemy.orm import Session
from db.db import SessionLocal
from models.login_activity import LoginActivity

class LoginTracker:
    def record(self, user_name: str, action: str):
        db: Session = SessionLocal()
        try:
            today = str(date.today())
            now = time.strftime("%H:%M")
            entry = LoginActivity(user_name=user_name, action=action, time=now, date=today)
            db.add(entry)
            db.commit()
        finally:
            db.close()

    def get_recent(self, limit: int = 7):
        db: Session = SessionLocal()
        try:
            today = str(date.today())
            today_count = db.query(LoginActivity).filter(LoginActivity.date == today).count()
            recent = db.query(LoginActivity).order_by(LoginActivity.id.desc()).limit(limit).all()
            return {
                "today_count": today_count,
                "recent": [{"name": r.user_name, "action": r.action, "time": r.time, "date": r.date} for r in recent],
            }
        finally:
            db.close()

login_tracker = LoginTracker()
