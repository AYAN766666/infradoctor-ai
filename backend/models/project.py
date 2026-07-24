from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from db.db import Base
from datetime import datetime

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    github_url = Column(String(255))
    environment = Column(String(50))
    status = Column(String(50), default="active")
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    webhook_id = Column(Integer, nullable=True)
    webhook_active = Column(Integer, default=0)

    user = relationship("User", back_populates="projects")
    scans = relationship("ScanResult", back_populates="project", cascade="all, delete-orphan")
