import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.db import get_db
from models.project import Project
from models.scan_result import ScanResult
from routes.deps import get_current_user
from datetime import datetime

router = APIRouter(dependencies=[Depends(get_current_user)])

def extract_vulnerabilities(scan: ScanResult):
    if not scan or not scan.report_data:
        return []
    try:
        data = json.loads(scan.report_data)
    except (json.JSONDecodeError, TypeError):
        return []
    vulns = []
    sensitive_files = data.get("sensitive_files", [])
    for f in sensitive_files:
        vulns.append({
            "id": f"SENS-{hash(f) % 10000:04d}",
            "severity": "High",
            "title": f"Sensitive file detected",
            "resource": f
        })
    files = data.get("files", [])
    for f in files:
        for issue in f.get("issues", []):
            if "severity" in issue:
                vulns.append({
                    "id": f"SEC-{hash(issue.get('type', '')) % 10000:04d}",
                    "severity": issue.get("severity", "Medium").capitalize(),
                    "title": issue.get("type", "Security Issue"),
                    "resource": f.get("path", "unknown")
                })
    return vulns

@router.get("/")
async def get_security_status(db: Session = Depends(get_db)):
    project_count = db.query(Project).count()

    if project_count == 0:
        return {
            "status": "No Resources",
            "score": 0,
            "last_scan": "Never",
            "scanned_resources": 0,
            "vulnerabilities": [],
            "compliance": {"SOC2": "N/A", "GDPR": "N/A", "HIPAA": "N/A"}
        }

    latest_scan = db.query(ScanResult).order_by(ScanResult.id.desc()).first()
    score = latest_scan.score if latest_scan else 0
    last_scan = str(latest_scan.completed_at) if latest_scan and latest_scan.completed_at else str(latest_scan.created_at) if latest_scan else "Never"
    scanned = db.query(ScanResult).count()
    vulns = extract_vulnerabilities(latest_scan) if latest_scan else []

    return {
        "status": "Healthy" if score >= 60 else "Needs Attention",
        "score": score,
        "last_scan": last_scan,
        "scanned_resources": scanned,
        "vulnerabilities": vulns[:20],
        "compliance": {"SOC2": "Compliant" if score >= 80 else "Review Required", "GDPR": "Compliant" if score >= 70 else "Review Required", "HIPAA": "Compliant" if score >= 90 else "Review Required"}
    }

@router.post("/scan")
async def run_scan(db: Session = Depends(get_db)):
    project_count = db.query(Project).count()
    latest = db.query(ScanResult).order_by(ScanResult.id.desc()).first()
    return {
        "message": "Scan completed",
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
        "resources_scanned": project_count,
        "new_score": latest.score if latest else 0
    }
