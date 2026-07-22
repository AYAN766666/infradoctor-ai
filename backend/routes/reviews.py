from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.db import get_db
from models.review import Review
from routes.deps import get_current_user
from models.user import User
from pydantic import BaseModel

router = APIRouter()

class ReviewCreate(BaseModel):
    rating: int
    title: str | None = None
    comment: str

@router.get("/")
def get_reviews(db: Session = Depends(get_db)):
    reviews = db.query(Review).order_by(Review.created_at.desc()).all()
    return [{
        "id": r.id,
        "user_id": r.user_id,
        "user_name": r.user.name,
        "rating": r.rating,
        "title": r.title,
        "comment": r.comment,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in reviews]

@router.post("/")
def create_review(review: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    db_review = Review(
        user_id=user.id,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return {"id": db_review.id, "message": "Review submitted successfully"}
