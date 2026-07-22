import asyncio
from sqlalchemy.orm import Session
from db.db import SessionLocal
from models.alert import Alert
from models.project import Project
from models.log import Log
from models.scan_result import ScanResult
from models.setting import Setting
from datetime import datetime, timedelta
import json

from routes.ws import manager
from services.broadcast import broadcast_metrics, broadcast_projects

async def monitoring_engine():
    while True:
        await asyncio.sleep(30)
        
        db: Session = SessionLocal()
        
        try:
            projects = db.query(Project).all()
            
            if not projects:
                db.close()
                continue

            # Clean up old alerts (keep only last 50 per project)
            for project in projects:
                old_alerts = db.query(Alert).filter(
                    Alert.project_id == project.id
                ).order_by(Alert.id.desc()).offset(50).all()
                for old_alert in old_alerts:
                    db.delete(old_alert)

            db.commit()

            # Broadcast live updates to all connected users
            for project in projects:
                try:
                    await broadcast_metrics(project.user_id)
                    await broadcast_projects(project.user_id)
                except Exception:
                    pass

        finally:
            db.close()
