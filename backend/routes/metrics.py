from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.db import get_db
from models.project import Project
from models.scan_result import ScanResult
from models.infrastructure import Infrastructure
from routes.deps import get_current_user
from sqlalchemy import func

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/")
async def get_metrics(db: Session = Depends(get_db)):
    project_count = db.query(Project).count()

    if project_count == 0:
        return {
            "cpu": "0%",
            "ram": "0 GB",
            "disk": "0%",
            "active_nodes": 0
        }

    total_nodes = db.query(func.coalesce(func.sum(Infrastructure.nodes), 0)).scalar() or 0

    total_size = db.query(func.coalesce(func.sum(ScanResult.total_size_bytes), 0)).scalar() or 0
    total_issues = db.query(func.coalesce(func.sum(ScanResult.issues_found), 0)).scalar() or 0
    total_files = db.query(func.coalesce(func.sum(ScanResult.total_files), 0)).scalar() or 0

    cpu_val = min(90, max(5, int(total_files * 0.5 + total_issues * 2)))
    ram_val = round(total_size / (1024 * 1024 * 1024), 1) if total_size > 0 else 0.0
    disk_val = min(95, int(total_size / (1024 * 1024) * 0.1)) if total_size > 0 else 0

    def format_size(bytes_val):
        for unit in ["B", "KB", "MB", "GB"]:
            if bytes_val < 1024:
                return f"{bytes_val:.1f} {unit}"
            bytes_val /= 1024
        return f"{bytes_val:.1f} TB"

    return {
        "cpu": f"{cpu_val}%",
        "ram": f"{max(0.5, ram_val)} GB",
        "disk": f"{format_size(total_size)}",
        "active_nodes": int(total_nodes) if total_nodes > 0 else project_count
    }
