from fastapi import APIRouter, Depends
from routes.deps import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/")
async def get_team_members():
    return [
        {"id": 1, "name": "Aayan Ali", "role": "Admin", "email": "aayan@example.com"},
        {"id": 2, "name": "Jane Doe", "role": "Developer", "email": "jane@example.com"}
    ]
