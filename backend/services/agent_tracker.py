import time
from datetime import date
import logging

logger = logging.getLogger(__name__)


class AgentActivityTracker:
    def __init__(self, ttl_seconds=30):
        self._active_users: dict[int, float] = {}
        self._ttl = ttl_seconds
        self._today_total_chats: int = 0
        self._today_date: date = date.today()
        self._today_visitors: int = 0
        self._page_visits: dict[str, int] = {}

    def _check_date(self):
        today = date.today()
        if today != self._today_date:
            self._today_date = today
            self._today_total_chats = 0
            self._today_visitors = 0
            self._page_visits = {}

    def mark_active(self, user_id: int):
        self._active_users[user_id] = time.time()

    def record_chat(self, user_id: int = 0):
        self._check_date()
        self._today_total_chats += 1
        self.mark_active(user_id)

    def record_visit(self, page: str = "/"):
        self._check_date()
        self._today_visitors += 1
        self._page_visits[page] = self._page_visits.get(page, 0) + 1

    def get_active_count(self) -> int:
        now = time.time()
        self._active_users = {
            uid: ts for uid, ts in self._active_users.items()
            if now - ts < self._ttl
        }
        return len(self._active_users)

    def get_stats(self) -> dict:
        self._check_date()
        return {
            "active_users": self.get_active_count(),
            "today_chats": self._today_total_chats,
            "today_visitors": self._today_visitors,
            "page_breakdown": dict(self._page_visits),
        }

    def cleanup(self):
        self.get_active_count()


agent_tracker = AgentActivityTracker()
