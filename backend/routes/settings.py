from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from db.db import get_db
from models.project import Project
from models.alert import Alert
from models.log import Log
from models.ai_report import AIReport
from models.setting import Setting
from models.user import User
from services.limiter import limiter
from routes.deps import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/")
async def get_settings():
    return {
        "notifications": True,
        "theme": "dark",
        "language": "en"
    }

@router.post("/reset")
@limiter.limit("1/minute")
async def reset_system(request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        db.query(Alert).delete()
        db.query(Log).delete()
        db.query(AIReport).delete()
        db.query(Project).delete()
        db.commit()
        return {"message": "System reset successfully. All data cleared."}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}


@router.get('/focus')
def get_focus(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(Setting).filter(Setting.key == f'focused_project_id_{user.id}').first()
    if s and s.value:
        try:
            return {"project_id": int(s.value)}
        except:
            return {"project_id": None}
    return {"project_id": None}


@router.post('/focus')
def set_focus(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project_id = payload.get('project_id')
    if project_id is None:
        return {"error": "project_id required"}
    
    # Update last_seen for the project
    from models.project import Project
    from datetime import datetime
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.last_seen = datetime.utcnow()
    
    focus_key = f'focused_project_id_{user.id}'
    s = db.query(Setting).filter(Setting.key == focus_key).first()
    if not s:
        s = Setting(key=focus_key, value=str(project_id))
        db.add(s)
    else:
        s.value = str(project_id)
    db.commit()
    return {"project_id": int(project_id)}
