import asyncio
import sys
import os
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from services.limiter import limiter
from services.logger import logger

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

_import_error = None
try:
    from routes import auth, projects, logs, alerts, ai, security, team, settings, metrics, infrastructure, databases, reviews, ws, features
    from services.monitor import monitoring_engine
    from db.db import engine, Base
    from sqlalchemy import inspect, text
    from models import user, project, alert, log, ai_report, scan_result, review, comment
    import models.infrastructure
    import models.database
    import models.setting
except Exception as e:
    _import_error = f"{e}\n{traceback.format_exc()}"

if _import_error is None:
    try:
        logger.info("Database init...")
        Base.metadata.create_all(bind=engine)
        try:
            inspector = inspect(engine)
            if "projects" in inspector.get_table_names():
                cols = [c["name"] for c in inspector.get_columns("projects")]
                if "last_seen" not in cols:
                    sql = "ALTER TABLE projects ADD COLUMN last_seen DATETIME" if engine.dialect.name == "sqlite" else "ALTER TABLE projects ADD COLUMN last_seen TIMESTAMP"
                    with engine.begin() as conn:
                        conn.execute(text(sql))
        except Exception as e:
            logger.error(f"Migration: {e}")
    except Exception as e:
        logger.error(f"DB init: {e}")
    try:
        from services.init_data import init_db
        init_db()
    except Exception as e:
        logger.error(f"Init data: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if _import_error is None:
        me = os.getenv("MONITORING_ENABLED", "1")
        if me == "1" or me.lower() == "true":
            task = asyncio.create_task(monitoring_engine())
        else:
            task = None
        yield
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    else:
        yield

app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://infradoctor-frontend.vercel.app",
        "https://infradoctor-backend.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    if _import_error:
        return JSONResponse(status_code=500, content={"error": _import_error})
    return {"status": "ok", "service": "InfraDoctor AI API", "version": "1.0.0"}

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail or "An error occurred"})

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": f"Unhandled: {exc}"})

if _import_error is None:
    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(projects.router, prefix="/projects", tags=["projects"])
    app.include_router(logs.router, prefix="/logs", tags=["logs"])
    app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
    app.include_router(ai.router, prefix="/ai", tags=["ai"])
    app.include_router(security.router, prefix="/security", tags=["security"])
    app.include_router(team.router, prefix="/team", tags=["team"])
    app.include_router(settings.router, prefix="/settings", tags=["settings"])
    app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
    app.include_router(infrastructure.router, prefix="/infrastructure", tags=["infrastructure"])
    app.include_router(databases.router, prefix="/databases", tags=["databases"])
    app.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
    app.include_router(ws.router)
    app.include_router(features.router, prefix="", tags=["features"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
