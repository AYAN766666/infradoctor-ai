import json, os, re, requests, asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from db.db import get_db
from models.project import Project
from models.scan_result import ScanResult
from models.comment import Comment
from models.setting import Setting
from models.infrastructure import Infrastructure
from models.user import User
from routes.deps import get_current_user
from services.limiter import limiter
from urllib.parse import urlparse

router = APIRouter(dependencies=[Depends(get_current_user)])

# ─── AI Chat ────────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

@router.post("/ai/chat")
@limiter.limit("20/minute")
async def ai_chat(request: Request, body: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project_id = body.get("project_id")
    message = body.get("message", "")
    model = body.get("model", "groq")
    if not project_id or not message:
        raise HTTPException(400, "project_id and message required")
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    scan = db.query(ScanResult).filter(ScanResult.project_id == project_id).order_by(ScanResult.id.desc()).first()
    context = f"Project: {project.name}\nGitHub: {project.github_url}\nEnvironment: {project.environment}\n"
    if scan:
        report = json.loads(scan.report_data) if scan.report_data else {}
        files_summary = []
        for f in report.get("files", []):
            if f.get("issue_count", 0) > 0:
                issues = ", ".join(i["type"] for i in f.get("issues", []))
                files_summary.append(f"{f['path']} ({f['issue_count']} issues: {issues})")
        context += f"Scan Score: {scan.score}%\nIssues Found: {scan.issues_found}\nFiles with Issues:\n" + "\n".join(files_summary[:20])
    system_prompt = f"""You are InfraDoctor AI, a security infrastructure assistant. Answer questions about this project's scan results, security issues, and remediation.

Project Context:
{context}

Keep answers concise, actionable, and focused on infrastructure security. If asked about fixing issues, provide specific steps referencing the scan data. Max 3 paragraphs."""

    if GROQ_API_KEY and len(GROQ_API_KEY) > 10:
        try:
            import openai
            client = openai.OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1", timeout=15.0, max_retries=0)
            resp = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": message}],
            )
            return {"reply": resp.choices[0].message.content}
        except Exception as e:
            return {"reply": f"AI service temporarily unavailable: {str(e)[:100]}. Please try again later.", "error": str(e)[:200]}

    return {"reply": "AI Chat is not configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY in the backend .env file to enable AI features."}

# ─── One-Click Fix PR ──────────────────────────────────────────────────────
@router.post("/projects/{project_id}/fix-pr")
@limiter.limit("3/minute")
async def create_fix_pr(request: Request, project_id: int, body: dict = {}, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    scan = db.query(ScanResult).filter(ScanResult.project_id == project_id).order_by(ScanResult.id.desc()).first()
    if not scan or scan.status != "completed":
        raise HTTPException(400, "No completed scan found for this project")
    report = json.loads(scan.report_data) if scan.report_data else {}
    files = report.get("files", [])
    if not files:
        raise HTTPException(400, "No files found in scan results")
    parsed = urlparse(project.github_url)
    parts = parsed.path.strip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(400, "Invalid GitHub URL")
    owner, repo = parts[0], parts[1]
    token = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN")
    if not token or token.startswith("ghp_placeholder"):
        return {"error": "GITHUB_TOKEN not configured on backend", "fixes": []}
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
    fix_files = []
    for f in files:
        if f.get("issue_count", 0) > 0:
            file_content_resp = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/main/{f['path']}", timeout=10)
            if file_content_resp.status_code == 404:
                file_content_resp = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/master/{f['path']}", timeout=10)
            if file_content_resp.status_code == 200:
                content = file_content_resp.text
                new_content = content
                for issue in f.get("issues", []):
                    issue_type = issue.get("type", "")
                    match_str = issue.get("match", "")
                    if match_str and len(match_str) > 4:
                        cleaned = match_str.replace("****", "")
                        if cleaned in new_content:
                            new_content = new_content.replace(cleaned, f"# FIXED: {issue_type} - see remediation\n# {cleaned}")
                if new_content != content:
                    fix_files.append({"path": f["path"], "original": content, "fixed": new_content})
    if not fix_files:
        return {"message": "No auto-fixable issues found. Issues require manual remediation.", "fixes": []}
    branch_name = f"infradoctor-fix-{scan.id}-{int(datetime.utcnow().timestamp())}"
    try:
        repo_resp = requests.get(f"https://api.github.com/repos/{owner}/{repo}", headers=headers, timeout=10)
        default_branch = repo_resp.json().get("default_branch", "main") if repo_resp.status_code == 200 else "main"
        ref_resp = requests.get(f"https://api.github.com/repos/{owner}/{repo}/git/refs/heads/{default_branch}", headers=headers, timeout=10)
        if ref_resp.status_code != 200:
            return {"error": f"Cannot access repo {owner}/{repo}. Make sure GITHUB_TOKEN has repo scope.", "fixes": []}
        sha = ref_resp.json()["object"]["sha"]
        requests.post(f"https://api.github.com/repos/{owner}/{repo}/git/refs", headers=headers, json={"ref": f"refs/heads/{branch_name}", "sha": sha}, timeout=10)
        for ff in fix_files:
            resp = requests.put(f"https://api.github.com/repos/{owner}/{repo}/contents/{ff['path']}", headers=headers, json={
                "message": f"fix: {ff['path']} - security remediation by InfraDoctor AI",
                "content": ff["fixed"].encode("utf-8").hex() if hasattr(ff['fixed'], 'encode') else base64.b64encode(ff['fixed'].encode()).decode(),
                "branch": branch_name,
            }, timeout=10)
        pr_body = f"## InfraDoctor AI - Auto-generated Security Fix PR\n\nThis PR fixes {len(fix_files)} file(s) with security issues detected by InfraDoctor AI.\n\n### Files Fixed:\n" + "\n".join(f"- [{ff['path']}](https://github.com/{owner}/{repo}/blob/{branch_name}/{ff['path']})" for ff in fix_files)
        pr_resp = requests.post(f"https://api.github.com/repos/{owner}/{repo}/pulls", headers=headers, json={
            "title": f"[InfraDoctor] Security fixes - {len(fix_files)} file(s)",
            "head": branch_name,
            "base": default_branch,
            "body": pr_body,
        }, timeout=10)
        if pr_resp.status_code == 201:
            pr_data = pr_resp.json()
            return {"message": f"Fix PR created successfully!", "pr_url": pr_data["html_url"], "pr_number": pr_data["number"], "fixes": fix_files}
        return {"error": f"PR creation failed: {pr_resp.json().get('message', 'Unknown')}", "fixes": fix_files}
    except Exception as e:
        return {"error": f"Failed to create PR: {str(e)[:200]}", "fixes": fix_files}

import base64

# ─── Score Timeline ────────────────────────────────────────────────────────
@router.get("/projects/{project_id}/scores")
def get_score_timeline(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    scans = db.query(ScanResult).filter(ScanResult.project_id == project_id).order_by(ScanResult.created_at.asc()).all()
    return {"scores": [{"id": s.id, "score": s.score, "issues": s.issues_found, "files": s.total_files, "date": str(s.created_at) if s.created_at else None} for s in scans]}

# ─── Drift Detection ───────────────────────────────────────────────────────
@router.get("/projects/{project_id}/drift")
def get_drift(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    scans = db.query(ScanResult).filter(ScanResult.project_id == project_id).order_by(ScanResult.id.desc()).limit(2).all()
    if len(scans) < 2:
        return {"drift": None, "message": "Need at least 2 scans to detect drift. Run another scan."}
    old, new = scans[1], scans[0]
    old_data = json.loads(old.report_data) if old.report_data else {}
    new_data = json.loads(new.report_data) if new.report_data else {}
    old_files = {f["path"]: f for f in old_data.get("files", [])}
    new_files = {f["path"]: f for f in new_data.get("files", [])}
    added = [p for p in new_files if p not in old_files]
    removed = [p for p in old_files if p not in new_files]
    new_issues = []
    fixed_issues = []
    for path, nf in new_files.items():
        of = old_files.get(path)
        if of:
            new_issue_types = set(i["type"] for i in nf.get("issues", []))
            old_issue_types = set(i["type"] for i in of.get("issues", []))
            for t in new_issue_types - old_issue_types:
                new_issues.append({"path": path, "type": t})
            for t in old_issue_types - new_issue_types:
                fixed_issues.append({"path": path, "type": t})
    return {
        "drift": {
            "score_change": new.score - old.score,
            "old_score": old.score,
            "new_score": new.score,
            "old_issues": old.issues_found,
            "new_issues_count": new.issues_found,
            "files_added": added,
            "files_removed": removed,
            "new_issues": new_issues,
            "fixed_issues": fixed_issues,
        },
        "old_scan_id": old.id,
        "new_scan_id": new.id,
    }

# ─── Collaboration Comments ────────────────────────────────────────────────
@router.get("/projects/{project_id}/comments")
def get_comments(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    comments = db.query(Comment).filter(Comment.project_id == project_id).order_by(Comment.created_at.desc()).limit(100).all()
    return {"comments": [{
        "id": c.id, "user_id": c.user_id, "text": c.text, "resolved": c.resolved,
        "parent_id": c.parent_id, "created_at": str(c.created_at) if c.created_at else None,
        "author_name": c.user.name if c.user else "Unknown",
    } for c in comments]}

@router.post("/projects/{project_id}/comments")
async def add_comment(request: Request, project_id: int, body: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(400, "Comment text required")
    parent_id = body.get("parent_id")
    comment = Comment(project_id=project_id, user_id=user.id, text=text, parent_id=parent_id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {"comment": {"id": comment.id, "text": comment.text, "user_id": comment.user_id, "author_name": user.name, "created_at": str(comment.created_at), "resolved": comment.resolved}}

@router.post("/projects/{project_id}/comments/{comment_id}/resolve")
async def resolve_comment(project_id: int, comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.project_id == project_id).first()
    if not comment:
        raise HTTPException(404, "Comment not found")
    comment.resolved = 1 - comment.resolved
    db.commit()
    return {"resolved": bool(comment.resolved)}

# ─── Compliance Reports ────────────────────────────────────────────────────
COMPLIANCE_FRAMEWORKS = {
    "SOC2": {"description": "Service Organization Control 2 - Security, Availability, Processing Integrity, Confidentiality, Privacy"},
    "HIPAA": {"description": "Health Insurance Portability and Accountability Act - Protected Health Information"},
    "PCI-DSS": {"description": "Payment Card Industry Data Security Standard"},
}

@router.get("/projects/{project_id}/compliance")
def get_compliance_report(project_id: int, framework: str = "SOC2", db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    scan = db.query(ScanResult).filter(ScanResult.project_id == project_id).order_by(ScanResult.id.desc()).first()
    if not scan:
        return {"framework": framework, "status": "no_scan", "report": "Run a security scan first."}
    report = json.loads(scan.report_data) if scan.report_data else {}
    files = report.get("files", [])
    all_issues = []
    for f in files:
        for iss in f.get("issues", []):
            all_issues.append({**iss, "file": f["path"]})
    framework_info = COMPLIANCE_FRAMEWORKS.get(framework, COMPLIANCE_FRAMEWORKS["SOC2"])
    critical_issues = [i for i in all_issues if i.get("severity") == "critical"]
    high_issues = [i for i in all_issues if i.get("severity") == "high"]
    medium_issues = [i for i in all_issues if i.get("severity") == "medium"]
    passed = scan.score >= 80
    return {
        "framework": framework,
        "framework_description": framework_info["description"],
        "project": project.name,
        "scan_score": scan.score,
        "status": "passed" if passed else "failed",
        "summary": {
            "total_issues": len(all_issues),
            "critical": len(critical_issues),
            "high": len(high_issues),
            "medium": len(medium_issues),
            "passed_checks": max(0, 10 - len(critical_issues)),
            "failed_checks": min(10, len(critical_issues) + len(high_issues)),
            "total_checks": 10,
        },
        "checks": [
            {"id": "SEC-01", "name": "No hardcoded secrets", "passed": len([i for i in all_issues if "key" in i.get("type","").lower() or "secret" in i.get("type","").lower() or "token" in i.get("type","").lower()]) == 0, "severity": "critical"},
            {"id": "SEC-02", "name": "No exposed passwords", "passed": len([i for i in all_issues if "password" in i.get("type","").lower()]) == 0, "severity": "critical"},
            {"id": "SEC-03", "name": "No sensitive filenames in repo", "passed": len([f for f in files if f.get("sensitive_name")]) == 0, "severity": "high"},
            {"id": "SEC-04", "name": "No large files in repo", "passed": len([f for f in files if f.get("is_large")]) == 0, "severity": "medium"},
            {"id": "SEC-05", "name": "Security score >= 80", "passed": scan.score >= 80, "severity": "high"},
            {"id": "SEC-06", "name": "No critical severity issues", "passed": len(critical_issues) == 0, "severity": "critical"},
            {"id": "SEC-07", "name": "No high severity issues", "passed": len(high_issues) == 0, "severity": "high"},
            {"id": "SEC-08", "name": "Repository has less than 10 issues", "passed": scan.issues_found < 10, "severity": "medium"},
            {"id": "SEC-09", "name": "No database connection strings exposed", "passed": len([i for i in all_issues if "database" in i.get("type","").lower() or "connection" in i.get("type","").lower()]) == 0, "severity": "critical"},
            {"id": "SEC-10", "name": "No private keys exposed", "passed": len([i for i in all_issues if "private" in i.get("type","").lower() or "key" in i.get("type","").lower()]) == 0, "severity": "critical"},
        ],
        "remediation_deadline": "Immediate" if not passed else "Next review cycle",
    }

# ─── Slack/Discord Webhook ─────────────────────────────────────────────────
@router.post("/settings/webhook")
async def set_webhook(request: Request, body: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    url = body.get("url", "").strip()
    webhook_type = body.get("type", "slack")
    if url and not url.startswith("https://hooks.slack.com/") and not url.startswith("https://discord.com/api/webhooks/"):
        if webhook_type == "slack" and not url.startswith("https://hooks.slack.com/"):
            raise HTTPException(400, "Invalid Slack webhook URL. Must start with https://hooks.slack.com/")
        if webhook_type == "discord" and not url.startswith("https://discord.com/api/webhooks/"):
            raise HTTPException(400, "Invalid Discord webhook URL")
    key = f"webhook_url_{user.id}"
    s = db.query(Setting).filter(Setting.key == key).first()
    if not s:
        s = Setting(key=key, value=url)
        db.add(s)
    else:
        s.value = url
    db.commit()
    return {"message": "Webhook updated successfully", "url": url, "type": webhook_type}

@router.get("/settings/webhook")
def get_webhook(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(Setting).filter(Setting.key == f"webhook_url_{user.id}").first()
    return {"url": s.value if s and s.value else "", "type": "slack"}

# ─── Multi-Cloud Insights ──────────────────────────────────────────────────
@router.get("/projects/{project_id}/cloud-insights")
def get_cloud_insights(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    scan = db.query(ScanResult).filter(ScanResult.project_id == project_id).order_by(ScanResult.id.desc()).first()
    infra = db.query(Infrastructure).filter(Infrastructure.project_id == project_id).all()
    report = json.loads(scan.report_data) if scan and scan.report_data else {}
    files = report.get("files", [])
    cloud_providers = {"AWS": {"issues": 0, "files": [], "services": []}, "GCP": {"issues": 0, "files": [], "services": []}, "Azure": {"issues": 0, "files": [], "services": []}}
    for f in files:
        path_lower = f["path"].lower()
        if any(k in path_lower for k in ["aws", "amazon", "s3", "ec2", "lambda"]):
            provider = "AWS"
        elif any(k in path_lower for k in ["gcp", "google", "gcloud", "bigquery"]):
            provider = "GCP"
        elif any(k in path_lower for k in ["azure", "microsoft"]):
            provider = "Azure"
        else:
            continue
        cloud_providers[provider]["files"].append(f["path"])
        cloud_providers[provider]["issues"] += f.get("issue_count", 0)
    for i in infra:
        region = (i.region or "").lower()
        if "aws" in region or "us-east" in region or "eu-west" in region or "ap-" in region:
            cloud_providers["AWS"]["services"].append(i.name)
        elif "gcp" in region or "google" in region:
            cloud_providers["GCP"]["services"].append(i.name)
        elif "azure" in region:
            cloud_providers["Azure"]["services"].append(i.name)
    return {"providers": {k: {**v, "file_count": len(v["files"]), "files": v["files"][:20]} for k, v in cloud_providers.items()}}
