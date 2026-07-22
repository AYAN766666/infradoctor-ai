from sqlalchemy import Column, Integer, String, ForeignKey
from db.db import Base

class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    content = Column(String, nullable=False)
    severity = Column(String(50))
