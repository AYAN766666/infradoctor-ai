import asyncio
import json
from fastapi import WebSocket, WebSocketDisconnect, Query, APIRouter
from sqlalchemy.orm import Session
from db.db import SessionLocal, get_db
from models.user import User
from services.auth_service import decode_token

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [w for w in self.active_connections[user_id] if w != websocket]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            payload = json.dumps(message)
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(payload)
                except Exception:
                    pass

    async def broadcast_to_all(self, message: dict):
        payload = json.dumps(message)
        for user_id, connections in list(self.active_connections.items()):
            for ws in connections:
                try:
                    await ws.send_text(payload)
                except Exception:
                    pass

manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = decode_token(token)
        email = payload.get("sub")
        if not email:
            await websocket.close(code=4001)
            return

        db: Session = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                await websocket.close(code=4001)
                return
        finally:
            db.close()
    except Exception:
        await websocket.close(code=4001)
        return

    user_id = user.id
    await manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                msg_type = msg.get("type", "")
                if msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)
