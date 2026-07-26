from sqlalchemy import Column, Integer, String
from db.db import Base

class LoginActivity(Base):
    __tablename__ = "login_activity"

    id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String(255), nullable=False)
    action = Column(String(50), nullable=False)
    time = Column(String(10), nullable=False)
    date = Column(String(20), nullable=False)
