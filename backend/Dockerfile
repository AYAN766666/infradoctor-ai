FROM python:3.12-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || pip install --no-cache-dir \
    fastapi uvicorn sqlalchemy pydantic python-dotenv pyjwt passlib bcrypt \
    openai ollama httpx slowapi psycopg2-binary

EXPOSE 8000

CMD ["python", "start.py"]
