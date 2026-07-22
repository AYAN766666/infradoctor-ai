import json
from sqlalchemy.orm import Session
from db.db import SessionLocal
from models.alert import Alert
from models.project import Project
from models.scan_result import ScanResult
from datetime import datetime, timedelta
import asyncio

from routes.ws import manager


async def broadcast_metrics(user_id: int):
    db: Session = SessionLocal()
    try:
        projects = db.query(Project).filter(Project.user_id == user_id).all()
        total_score = 0
        total_files = 0
        total_issues = 0
        total_bytes = 0
        active_count = 0
        for p in projects:
            latest_scan = db.query(ScanResult).filter(ScanResult.project_id == p.id).order_by(ScanResult.id.desc()).first()
            if latest_scan:
                total_score += latest_scan.score or 0
                total_files += latest_scan.total_files or 0
                total_issues += latest_scan.issues_found or 0
                total_bytes += latest_scan.total_size_bytes or 0
                active_count += 1

        avg_score = round(total_score / active_count) if active_count > 0 else 0
        alert_count = db.query(Alert).filter(Alert.project_id.in_([p.id for p in projects])).count() if projects else 0

        await manager.broadcast_to_user(user_id, {
            "type": "metrics",
            "data": {
                "projects": len(projects),
                "alerts": alert_count,
                "avg_score": avg_score,
                "total_files": total_files,
                "total_issues": total_issues,
                "total_size_bytes": total_bytes,
            }
        })
    finally:
        db.close()


async def broadcast_alerts(user_id: int, project_id: int):
    db: Session = SessionLocal()
    try:
        alerts = db.query(Alert).filter(Alert.project_id == project_id).order_by(Alert.id.desc()).limit(10).all()
        await manager.broadcast_to_user(user_id, {
            "type": "alerts",
            "project_id": project_id,
            "data": [{"id": a.id, "title": a.title, "severity": a.severity, "status": a.status, "created_at": str(a.created_at) if a.created_at else None} for a in alerts]
        })
    finally:
        db.close()


async def broadcast_projects(user_id: int):
    db: Session = SessionLocal()
    try:
        projects = db.query(Project).filter(Project.user_id == user_id).order_by(Project.id.desc()).all()
        result = []
        for p in projects:
            latest_scan = db.query(ScanResult).filter(ScanResult.project_id == p.id).order_by(ScanResult.id.desc()).first()
            scan_info = None
            if latest_scan:
                bytes_val = latest_scan.total_size_bytes or 0
                for unit in ["B", "KB", "MB", "GB"]:
                    if bytes_val < 1024:
                        size_hr = f"{bytes_val:.1f} {unit}"
                        break
                    bytes_val /= 1024
                else:
                    size_hr = f"{bytes_val:.1f} TB"
                scan_info = {
                    "id": latest_scan.id,
                    "status": latest_scan.status,
                    "score": latest_scan.score,
                    "issues_found": latest_scan.issues_found,
                    "total_files": latest_scan.total_files,
                    "total_size_hr": size_hr,
                }
            result.append({
                "id": p.id,
                "name": p.name,
                "github_url": p.github_url,
                "environment": p.environment,
                "status": p.status,
                "last_seen": str(p.last_seen) if p.last_seen else None,
                "scan": scan_info,
            })
        await manager.broadcast_to_user(user_id, {
            "type": "projects",
            "data": result,
        })
    finally:
        db.close()
