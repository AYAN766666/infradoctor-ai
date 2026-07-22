from db.db import SessionLocal
from models.project import Project
from services.logger import logger

def init_db():
    db = SessionLocal()
    try:
        if db.query(Project).count() > 0:
            return
        logger.info("Database initialized - users can add projects")
    finally:
        db.close()
