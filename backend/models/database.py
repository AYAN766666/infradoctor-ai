from sqlalchemy import Column, Integer, String, ForeignKey
from db.db import Base

class Database(Base):
    __tablename__ = "databases"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)
    size = Column(String(50))
    status = Column(String(50), default="Online")
