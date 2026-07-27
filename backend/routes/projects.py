import json
import math
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from db.db import get_db
from models.project import Project
from models.scan_result import ScanResult
from models.infrastructure import Infrastructure
from models.database import Database
from routes.webhooks import parse_github_repo_url, register_github_webhook

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from models.ai_report import AIReport
from models.alert import Alert
from models.comment import Comment
from models.log import Log
from models.user import User
from services.scanner import scan_github_repo
from urllib.parse import urlparse
from services.limiter import limiter
from services.broadcast import broadcast_projects, broadcast_metrics
from routes.deps import get_current_user
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(dependencies=[Depends(get_current_user)])

class ProjectCreate(BaseModel):
    name: str
    github_url: str
    environment: str

class FileDeleteRequest(BaseModel):
    file_path: str

def auto_populate_infrastructure_and_databases(project_id: int, scan_result: dict, db: Session):
    files = scan_result.get("files", [])
    file_paths = [f["path"].lower() for f in files]

    infra_regions = ["us-east-1", "eu-west-1", "ap-south-1"]
    infra_added = False
    for path in file_paths:
        if "docker" in path or "k8s" in path or "kubernetes" in path or "terraform" in path or "helm" in path:
            name = "Docker" if "docker" in path else "Kubernetes" if ("k8s" in path or "kubernetes" in path) else "Terraform" if "terraform" in path else "Helm"
            infra = Infrastructure(project_id=project_id, name=f"{name} Cluster", region=infra_regions[hash(path) % 3], nodes=max(1, hash(path) % 5 + 1))
            db.add(infra)
            infra_added = True
            break

    if not infra_added:
        infra = Infrastructure(project_id=project_id, name="Default Cluster", region="us-east-1", nodes=2)
        db.add(infra)

    db_added = False
    for path in file_paths:
        if any(dbkw in path for dbkw in [".sql", "prisma", "schema", "sequelize", "typeorm", "drizzle", "migration"]):
            db_type = "PostgreSQL" if "postgres" in path or "prisma" in path else "MySQL" if "mysql" in path else "SQLite" if "sqlite" in path else "MongoDB" if "mongo" in path else "Generic"
            db_entry = Database(project_id=project_id, name=f"{db_type} Database", type=db_type, size="10 GB")
            db.add(db_entry)
            db_added = True
            break

    if not db_added:
        db_entry = Database(project_id=project_id, name="Primary Database", type="PostgreSQL", size="10 GB")
        db.add(db_entry)

    db.commit()

@router.post("/")
@limiter.limit("5/minute")
def create_project(request: Request, project: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    parsed = urlparse(project.github_url)
    if "github.com" not in parsed.netloc:
        raise HTTPException(status_code=400, detail="Only GitHub URLs (github.com) are supported.")
    db_project = Project(user_id=user.id, **project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    try:
        scan_result = scan_github_repo(db_project.github_url)
    except Exception as e:
        logger.error(f"Scan failed for {db_project.github_url}: {e}")
        scan_result = {
            "status": "error",
            "error": f"Scan failed: {str(e)[:200]}",
            "files": [],
            "summary": {"total_files": 0, "issues_found": 0, "score": 0, "sensitive_files_count": 0, "large_files_count": 0, "secure": False},
            "ai_report": "",
        }

    auto_populate_infrastructure_and_databases(db_project.id, scan_result, db)

    report = ScanResult(
        project_id=db_project.id,
        status=scan_result.get("status", "error"),
        score=scan_result.get("summary", {}).get("score", 0),
        total_files=scan_result.get("summary", {}).get("total_files", 0),
        scanned_files=len(scan_result.get("files", [])),
        issues_found=scan_result.get("summary", {}).get("issues_found", 0),
        total_size_bytes=scan_result.get("summary", {}).get("total_size_bytes", 0),
        report_data=json.dumps(scan_result),
        completed_at=datetime.utcnow() if scan_result.get("status") == "completed" else None,
    )
    db.add(report)
    db.commit()

    try:
        owner, repo_name = parse_github_repo_url(db_project.github_url)
        if owner and repo_name:
            hook_id, err = register_github_webhook(owner, repo_name)
            if hook_id:
                db_project.webhook_id = hook_id
                db_project.webhook_active = 1
                db.commit()
                logger.info(f"Auto-created webhook {hook_id} for {owner}/{repo_name}")
            else:
                logger.warning(f"Auto-webhook failed for {owner}/{repo_name}: {err}")
    except Exception as e:
        logger.error(f"Auto-webhook exception: {e}")

    try:
        loop = asyncio.get_event_loop()
        loop.create_task(broadcast_projects(user.id))
        loop.create_task(broadcast_metrics(user.id))
    except Exception:
        pass

    return {
        "project": {
            "id": db_project.id,
            "name": db_project.name,
            "github_url": db_project.github_url,
            "environment": db_project.environment,
            "status": db_project.status,
            "webhook_id": db_project.webhook_id,
            "webhook_active": bool(db_project.webhook_active),
        },
        "scan": {
            "id": report.id,
            "status": report.status,
            "score": report.score,
            "total_files": report.total_files,
            "issues_found": report.issues_found,
            "total_size_hr": scan_result.get("summary", {}).get("total_size_hr", "0 B"),
            "secure": scan_result.get("summary", {}).get("secure", False),
            "sensitive_files_count": scan_result.get("summary", {}).get("sensitive_files_count", 0),
            "large_files_count": scan_result.get("summary", {}).get("large_files_count", 0),
            "ai_report": scan_result.get("ai_report", ""),
        }
    }

@router.get("/")
def get_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    query = db.query(Project).filter(Project.user_id == user.id)
    total = query.count()
    projects = query.order_by(Project.id.desc()).offset(skip).limit(limit).all()
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
            report_summary = json.loads(latest_scan.report_data).get("summary", {}) if latest_scan.report_data else {}
            report_data_parsed = json.loads(latest_scan.report_data) if latest_scan.report_data else {}
            scan_info = {
                "id": latest_scan.id,
                "status": latest_scan.status,
                "score": latest_scan.score,
                "issues_found": latest_scan.issues_found,
                "total_files": latest_scan.total_files,
                "total_size_hr": size_hr,
                "sensitive_files_count": report_summary.get("sensitive_files_count", 0),
                "large_files_count": report_summary.get("large_files_count", 0),
                "secure": report_summary.get("secure", False),
                "ai_report": report_data_parsed.get("ai_report", ""),
            }
        result.append({
            "id": p.id,
            "user_id": p.user_id,
            "name": p.name,
            "github_url": p.github_url,
            "environment": p.environment,
            "status": p.status,
            "last_seen": str(p.last_seen) if p.last_seen else None,
            "webhook_id": p.webhook_id,
            "webhook_active": bool(p.webhook_active),
            "scan": scan_info,
        })
    return {
        "projects": result,
        "total": total,
        "skip": skip,
        "limit": limit,
        "pages": math.ceil(total / limit) if limit > 0 else 0,
    }

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db_project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.query(ScanResult).filter(ScanResult.project_id == project_id).delete()
    db.query(AIReport).filter(AIReport.project_id == project_id).delete()
    db.query(Database).filter(Database.project_id == project_id).delete()
    db.query(Alert).filter(Alert.project_id == project_id).delete()
    db.query(Comment).filter(Comment.project_id == project_id).delete()
    db.query(Infrastructure).filter(Infrastructure.project_id == project_id).delete()
    db.query(Log).filter(Log.project_id == project_id).delete()
    db.delete(db_project)
    db.commit()

    try:
        loop = asyncio.get_event_loop()
        loop.create_task(broadcast_projects(user.id))
        loop.create_task(broadcast_metrics(user.id))
    except Exception:
        pass

    return {"message": "Project deleted successfully"}

@router.post("/{project_id}/scan")
@limiter.limit("5/minute")
def trigger_scan(request: Request, project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db_project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    parsed = urlparse(db_project.github_url)
    if "github.com" not in parsed.netloc:
        raise HTTPException(status_code=400, detail="Only GitHub URLs (github.com) are supported.")

    try:
        scan_result = scan_github_repo(db_project.github_url)
    except Exception as e:
        logger.error(f"Scan failed for {db_project.github_url}: {e}")
        scan_result = {
            "status": "error",
            "error": f"Scan failed: {str(e)[:200]}",
            "files": [],
            "summary": {"total_files": 0, "issues_found": 0, "score": 0, "sensitive_files_count": 0, "large_files_count": 0, "secure": False},
            "ai_report": "",
        }

    auto_populate_infrastructure_and_databases(project_id, scan_result, db)

    if not db_project.webhook_id:
        try:
            owner, repo_name = parse_github_repo_url(db_project.github_url)
            if owner and repo_name:
                hook_id, err = register_github_webhook(owner, repo_name)
                if hook_id:
                    db_project.webhook_id = hook_id
                    db_project.webhook_active = 1
                    db.commit()
                    logger.info(f"Auto-created webhook {hook_id} for {owner}/{repo_name}")
                else:
                    logger.warning(f"Auto-webhook failed for {owner}/{repo_name}: {err}")
        except Exception as e:
            logger.error(f"Auto-webhook exception: {e}")

    report = ScanResult(
        project_id=db_project.id,
        status=scan_result.get("status", "error"),
        score=scan_result.get("summary", {}).get("score", 0),
        total_files=scan_result.get("summary", {}).get("total_files", 0),
        scanned_files=len(scan_result.get("files", [])),
        issues_found=scan_result.get("summary", {}).get("issues_found", 0),
        total_size_bytes=scan_result.get("summary", {}).get("total_size_bytes", 0),
        report_data=json.dumps(scan_result),
        completed_at=datetime.utcnow() if scan_result.get("status") == "completed" else None,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    try:
        loop = asyncio.get_event_loop()
        loop.create_task(broadcast_projects(user.id))
        loop.create_task(broadcast_metrics(user.id))
    except Exception:
        pass

    return {
        "id": report.id,
        "status": report.status,
        "score": report.score,
        "total_files": report.total_files,
        "issues_found": report.issues_found,
        "total_size_hr": scan_result.get("summary", {}).get("total_size_hr", "0 B"),
        "secure": scan_result.get("summary", {}).get("secure", False),
        "sensitive_files_count": scan_result.get("summary", {}).get("sensitive_files_count", 0),
        "large_files_count": scan_result.get("summary", {}).get("large_files_count", 0),
        "error": scan_result.get("error"),
        "ai_report": scan_result.get("ai_report", ""),
    }

@router.get("/{project_id}/scan")
def get_scan_results(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db_project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")

    latest_scan = db.query(ScanResult).filter(ScanResult.project_id == project_id).order_by(ScanResult.id.desc()).first()
    if not latest_scan:
        return {"scan": None}

    report_data = json.loads(latest_scan.report_data) if latest_scan.report_data else {}

    summary = report_data.get("summary", {})
    return {
        "scan": {
            "id": latest_scan.id,
            "status": latest_scan.status,
            "score": latest_scan.score,
            "total_files": latest_scan.total_files,
            "scanned_files": latest_scan.scanned_files,
            "issues_found": latest_scan.issues_found,
            "sensitive_files_count": summary.get("sensitive_files_count", 0),
            "large_files_count": summary.get("large_files_count", 0),
            "total_size_bytes": latest_scan.total_size_bytes,
            "total_size_hr": summary.get("total_size_hr", "0 B"),
            "secure": summary.get("secure", False),
            "created_at": str(latest_scan.created_at) if latest_scan.created_at else None,
            "completed_at": str(latest_scan.completed_at) if latest_scan.completed_at else None,
            "files": report_data.get("files", []),
            "sensitive_files": report_data.get("sensitive_files", []),
            "large_files": report_data.get("large_files", []),
            "error": report_data.get("error"),
            "ai_report": report_data.get("ai_report", ""),
        }
    }
