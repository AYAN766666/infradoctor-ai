import time
from datetime import date

class LoginTracker:
    def __init__(self):
        self._events: list[dict] = []
        self._today_count: int = 0
        self._today_date: date = date.today()

    def record(self, user_name: str, action: str):
        today = date.today()
        if today != self._today_date:
            self._today_date = today
            self._today_count = 0
        self._today_count += 1
        self._events.insert(0, {
            "name": user_name,
            "action": action,
            "time": time.strftime("%H:%M"),
            "date": str(today),
        })
        if len(self._events) > 50:
            self._events.pop()

    def get_recent(self, limit: int = 7):
        return {
            "today_count": self._today_count,
            "recent": self._events[:limit],
        }

login_tracker = LoginTracker()
