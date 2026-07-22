from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.db import get_db
from models.alert import Alert
from routes.deps import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/{project_id}")
def get_alerts(project_id: int, db: Session = Depends(get_db)):
    return db.query(Alert).filter(Alert.project_id == project_id).all()
