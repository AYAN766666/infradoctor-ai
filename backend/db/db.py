import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Explicitly load .env from the backend directory
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
example_dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env.example')
load_dotenv(dotenv_path)

# If DATABASE_URL is missing in .env, fallback to .env.example
if not os.getenv('DATABASE_URL') and os.path.exists(example_dotenv_path):
    load_dotenv(example_dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment variables.")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
