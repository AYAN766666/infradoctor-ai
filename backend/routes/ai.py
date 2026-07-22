from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from db.db import get_db
from models.ai_report import AIReport
from services.ai_service import analyze_log_with_ai
from services.limiter import limiter
from services.logger import logger
from routes.deps import get_current_user
from pydantic import BaseModel

router = APIRouter(dependencies=[Depends(get_current_user)])

class LogAnalysisRequest(BaseModel):
    project_id: int
    log_content: str

@router.post("/analyze-log")
@limiter.limit("10/minute")
def analyze_log(request: Request, req: LogAnalysisRequest, db: Session = Depends(get_db)):
    try:
        analysis = analyze_log_with_ai(req.log_content)
    except Exception as e:
        return {"error": f"AI analysis failed: {str(e)}", "summary": "Error", "root_cause": str(e), "severity": "error", "fix": []}
    
    try:
        fix_list = analysis.get("fix", [])
        if isinstance(fix_list, list):
            fix_str = ", ".join(fix_list)
        else:
            fix_str = str(fix_list)
        report = AIReport(
            project_id=req.project_id,
            summary=analysis.get("summary", "No summary"),
            root_cause=analysis.get("root_cause", "Unknown"),
            suggested_fix=fix_str,
        )
        db.add(report)
        db.commit()
    except Exception as e:
        logger.error(f"DB save failed: {e}")

    return analysis
