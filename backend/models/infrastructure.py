from sqlalchemy import Column, Integer, String, ForeignKey
from db.db import Base

class Infrastructure(Base):
    __tablename__ = "infrastructure"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    region = Column(String(100))
    status = Column(String(50), default="Healthy")
    nodes = Column(Integer, default=0)
