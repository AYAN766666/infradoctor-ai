from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.db import get_db
from models.log import Log
from routes.deps import get_current_user
from pydantic import BaseModel

router = APIRouter(dependencies=[Depends(get_current_user)])

class LogCreate(BaseModel):
    project_id: int
    content: str
    severity: str

@router.post("/")
def add_log(log: LogCreate, db: Session = Depends(get_db)):
    db_log = Log(**log.model_dump())
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.get("/{project_id}")
def get_logs(project_id: int, db: Session = Depends(get_db)):
    return db.query(Log).filter(Log.project_id == project_id).order_by(Log.id.desc()).limit(50).all()
