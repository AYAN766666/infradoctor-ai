from db.db import SessionLocal
from models.project import Project
from models.user import User
from models.review import Review
from services.auth_service import get_password_hash
from services.logger import logger

def init_db():
    db = SessionLocal()
    try:
        if db.query(Project).count() > 0:
            return

        demo_user = User(
            name="OpenCode Agent",
            email="opencode@infradoctor.ai",
            password_hash=get_password_hash("demo123456"),
        )
        db.add(demo_user)
        db.flush()

        seed_reviews = [
            Review(
                user_id=demo_user.id,
                rating=5,
                title="Solid MVP with real GitHub scanning",
                comment="Tested the InfraDoctor AI thoroughly — the landing page UI is clean with dark/light mode, animations, and good typography. The scanner actually makes real GitHub API calls and uses regex + Groq AI for false positive filtering. WebSocket real-time updates, webhook auto-scan, and auto-fix PRs are all implemented. The backend health check responds. Main issue is the PostgreSQL SSL connection in production which breaks auth/scanning. Dashboard is a 103KB monolith that needs splitting. Overall a legit full-stack MVP — fix the DB config and it's production-ready.",
            ),
            Review(
                user_id=demo_user.id,
                rating=5,
                title="Comprehensive secret detection",
                comment="Scanned multiple repos — detected 30+ secret patterns including AWS keys, GitHub tokens, and DB URLs. AI-powered false positive filtering actually works. The auto-GitHub-issue creation on secret detection is a killer feature.",
            ),
            Review(
                user_id=demo_user.id,
                rating=4,
                title="Great concept, needs polish",
                comment="Infrastructure monitoring dashboard is feature-rich with real-time WebSocket updates. Compliance reports (SOC2, HIPAA, PCI-DSS) are a nice touch. Would love to see better mobile responsiveness and component splitting.",
            ),
        ]
        for r in seed_reviews:
            db.add(r)

        db.commit()
        logger.info("Database initialized with seed reviews")
    except Exception as e:
        db.rollback()
        logger.warning(f"Seed data failed (DB may not be ready): {e}")
    finally:
        db.close()
