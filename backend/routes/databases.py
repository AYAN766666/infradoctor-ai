from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.db import get_db
from models.database import Database
from routes.deps import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/{project_id}")
def get_databases(project_id: int, db: Session = Depends(get_db)):
    return db.query(Database).filter(Database.project_id == project_id).all()

@router.post("/{project_id}")
def add_database(project_id: int, name: str, type: str, size: str, db: Session = Depends(get_db)):
    database = Database(project_id=project_id, name=name, type=type, size=size)
    db.add(database)
    db.commit()
    db.refresh(database)
    return database
