import asyncio
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from services.limiter import limiter
from services.logger import logger

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from routes import auth, projects, logs, alerts, ai, security, team, settings, metrics, infrastructure, databases, reviews, ws
from services.monitor import monitoring_engine
from db.db import engine, Base
from sqlalchemy import inspect, text

# Import all models to register them with Base (needed for table creation)
from models import user, project, alert, log, ai_report, scan_result, review
import models.infrastructure
import models.database
import models.setting

# Create tables if they don't exist
logger.info("Ensuring database schema is ready...")
Base.metadata.create_all(bind=engine)

# Ensure last_seen column exists on existing projects table
inspector = inspect(engine)
if "projects" in inspector.get_table_names():
    project_columns = [col["name"] for col in inspector.get_columns("projects")]
    if "last_seen" not in project_columns:
        logger.warning("Adding missing last_seen column to projects table...")
        alter_sql = "ALTER TABLE projects ADD COLUMN last_seen TIMESTAMP"
        if engine.dialect.name == "sqlite":
            alter_sql = "ALTER TABLE projects ADD COLUMN last_seen DATETIME"
        with engine.begin() as conn:
            conn.execute(text(alter_sql))
        logger.info("last_seen column added.")
logger.info("Database schema ready!")

# Seed initial demo data when database is empty
from services.init_data import init_db
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    monitoring_enabled = os.getenv("MONITORING_ENABLED", "1")
    if monitoring_enabled == "1" or monitoring_enabled.lower() == "true":
        task = asyncio.create_task(monitoring_engine())
    else:
        logger.info("Monitoring engine disabled (MONITORING_ENABLED=0)")
        task = None
    yield
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail or "An error occurred"},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error. Please try again later."},
    )

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

