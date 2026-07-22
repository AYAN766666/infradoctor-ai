from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from datetime import datetime
from db.db import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    severity = Column(String(50))
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
