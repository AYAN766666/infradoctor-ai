from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.db import get_db
from models.infrastructure import Infrastructure
from routes.deps import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/{project_id}")
def get_infrastructure(project_id: int, db: Session = Depends(get_db)):
    return db.query(Infrastructure).filter(Infrastructure.project_id == project_id).all()

@router.post("/{project_id}")
def add_infrastructure(project_id: int, name: str, region: str, nodes: int, db: Session = Depends(get_db)):
    infra = Infrastructure(project_id=project_id, name=name, region=region, nodes=nodes)
    db.add(infra)
    db.commit()
    db.refresh(infra)
    return infra
