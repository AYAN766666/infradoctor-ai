from sqlalchemy import Column, Integer, ForeignKey, Text
from db.db import Base

class AIReport(Base):
    __tablename__ = "ai_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    summary = Column(Text)
    root_cause = Column(Text)
    suggested_fix = Column(Text)
