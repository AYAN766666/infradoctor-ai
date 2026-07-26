import json
import asyncio
import hmac
import hashlib
import os
import logging
import requests
from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.orm import Session
from db.db import SessionLocal, get_db
from models.project import Project
from models.scan_result import ScanResult
from models.user import User
from services.scanner import scan_github_repo
from services.broadcast import broadcast_projects, broadcast_metrics
from routes.deps import get_current_user
from datetime import datetime
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET") or os.getenv("GITHUB_TOKEN") or ""
INFRA_DOCTOR_BASE = os.getenv("INFRA_DOCTOR_BASE") or "https://infradoctor-backend.vercel.app"

def github_api(owner: str, repo: str):
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def create_github_issue(owner: str, repo: str, title: str, body: str):
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        return None
    url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    headers = github_api(owner, repo)
    resp = requests.post(url, json={"title": title, "body": body}, headers=headers, timeout=15)
    if resp.status_code in (201, 200):
        return resp.json().get("html_url")
    return None

def find_existing_webhook(owner: str, repo: str):
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        return None
    url = f"https://api.github.com/repos/{owner}/{repo}/hooks"
    headers = github_api(owner, repo)
    resp = requests.get(url, headers=headers, timeout=15)
    if resp.status_code != 200:
        return None
    target_url = f"{INFRA_DOCTOR_BASE}/webhooks/github"
    for hook in resp.json():
        if hook.get("config", {}).get("url") == target_url:
            return hook.get("id")
    return None

def register_github_webhook(owner: str, repo: str):
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        logger.error("register_github_webhook: No GITHUB_TOKEN")
        return None, "No GitHub token configured"
    existing_id = find_existing_webhook(owner, repo)
    logger.info(f"register_github_webhook: existing_id={existing_id}")
    if existing_id:
        return existing_id, None
    url = f"https://api.github.com/repos/{owner}/{repo}/hooks"
    headers = github_api(owner, repo)
    hook_config = {
        "name": "web",
        "active": True,
        "events": ["push"],
        "config": {
            "url": f"{INFRA_DOCTOR_BASE}/webhooks/github",
            "content_type": "json",
            "insecure_ssl": "0",
        },
    }
    resp = requests.post(url, json=hook_config, headers=headers, timeout=15)
    if resp.status_code in (201, 200):
        data = resp.json()
        return data.get("id"), None
    err = resp.json().get("message", "Unknown error")
    return None, err

def delete_github_webhook(owner: str, repo: str, hook_id: int):
    token = os.getenv("GITHUB_TOKEN")
    if not token or not hook_id:
        return False
    url = f"https://api.github.com/repos/{owner}/{repo}/hooks/{hook_id}"
    headers = github_api(owner, repo)
    resp = requests.delete(url, headers=headers, timeout=15)
    return resp.status_code in (204, 200)

def parse_github_repo_url(url: str):
    parsed = urlparse(url)
    if "github.com" not in parsed.netloc:
        return None, None
    parts = parsed.path.strip("/").split("/")
    if len(parts) >= 2:
        return parts[0], parts[1]
    return None, None

# Webhook management endpoints
@router.post("/webhooks/register/{project_id}")
def register_webhook(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    owner, repo_name = parse_github_repo_url(project.github_url)
    if not owner:
        raise HTTPException(status_code=400, detail="Invalid GitHub URL")

    if project.webhook_id:
        delete_github_webhook(owner, repo_name, project.webhook_id)

    hook_id, error = register_github_webhook(owner, repo_name)
    if hook_id:
        project.webhook_id = hook_id
        project.webhook_active = 1
        db.commit()
        logger.info(f"Webhook registered: {hook_id} for project {project_id}")
        return {"status": "ok", "webhook_id": hook_id}
    logger.error(f"Webhook creation failed for {owner}/{repo_name}: {error}")
    return {"status": "error", "error": error or "Failed to create webhook"}

@router.post("/webhooks/unregister/{project_id}")
def unregister_webhook(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    owner, repo_name = parse_github_repo_url(project.github_url)
    if owner and project.webhook_id:
        delete_github_webhook(owner, repo_name, project.webhook_id)
    project.webhook_id = None
    project.webhook_active = 0
    db.commit()
    return {"status": "ok"}

@router.get("/webhooks/status/{project_id}")
def webhook_status(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "webhook_id": project.webhook_id,
        "webhook_active": bool(project.webhook_active),
    }

@router.post("/webhooks/github")
async def github_webhook(request: Request):
    body = await request.body()
    body_str = body.decode("utf-8")

    headers = request.headers
    event = headers.get("x-github-event", "")
    sig = headers.get("x-hub-signature-256", "")

    if WEBHOOK_SECRET and sig:
        expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(f"sha256={expected}", sig):
            raise HTTPException(status_code=401, detail="Invalid signature")

    if event != "push":
        return {"status": "ignored", "event": event}

    try:
        payload = json.loads(body_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    repo_full = (payload.get("repository") or {}).get("full_name", "")
    if not repo_full:
        return {"status": "ignored", "reason": "no repo"}

    github_url = f"https://github.com/{repo_full}"
    commit_msg = (payload.get("head_commit") or {}).get("message", "New push")

    db: Session = SessionLocal()
    try:
        project = db.query(Project).filter(Project.github_url == github_url).first()
        if not project:
            return {"status": "ignored", "reason": "no matching project"}

        try:
            scan_result = scan_github_repo(github_url)
        except Exception as e:
            logger.error(f"Webhook scan failed for {github_url}: {e}")
            scan_result = {
                "status": "error",
                "error": f"Scan failed: {str(e)[:200]}",
                "files": [],
                "summary": {"total_files": 0, "issues_found": 0, "score": 0},
                "ai_report": "",
            }

        report = ScanResult(
            project_id=project.id,
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
            loop = asyncio.get_event_loop()
            loop.create_task(broadcast_projects(project.user_id))
            loop.create_task(broadcast_metrics(project.user_id))
        except Exception:
            pass

        issues = scan_result.get("summary", {}).get("issues_found", 0)
        pr_url = None
        if issues > 0:
            owner, repo_name = parse_github_repo_url(github_url)
            if owner and repo_name:
                title = f"[InfraDoctor] {issues} security issue(s) found in latest scan"
                body = f"""## Security Scan Results

**Triggered by:** {commit_msg}

**Issues found:** {issues}
**Score:** {scan_result.get('summary', {}).get('score', 0)}/100

### Files with issues
"""
                for f in scan_result.get("files", []):
                    if f.get("issue_count", 0) > 0:
                        body += f"\n- **{f['path']}** ({f['issue_count']} issue(s))"
                        for iss in f.get("issues", []):
                            body += f"\n  - [{iss['severity'].upper()}] {iss['type']}: {iss.get('match', '')}"
                            if iss.get("remediation"):
                                body += f"\n    *Fix: {iss['remediation']}*"

                body += "\n\n---\n*This issue was auto-generated by InfraDoctor AI Security Scanner*"
                pr_url = create_github_issue(owner, repo_name, title, body)

        return {
            "status": "completed",
            "project_id": project.id,
            "issues_found": issues,
            "score": scan_result.get("summary", {}).get("score", 0),
            "issue_url": pr_url,
        }
    finally:
        db.close()
