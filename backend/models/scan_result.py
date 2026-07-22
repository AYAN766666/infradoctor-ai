from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from db.db import Base
from datetime import datetime

class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    status = Column(String(50), default="pending")
    score = Column(Integer, default=0)
    total_files = Column(Integer, default=0)
    scanned_files = Column(Integer, default=0)
    issues_found = Column(Integer, default=0)
    total_size_bytes = Column(Integer, default=0)
    report_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="scans")
