FROM python:3.10-slim

WORKDIR /app

# Install system dependencies including those for pdf manipulation
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    poppler-utils \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Adjust standard pyproject.toml requirement equivalents as a direct requirements.txt 
RUN pip install --no-cache-dir \
    fastapi>=0.115.0 \
    uvicorn[standard]>=0.30.0 \
    pydantic>=2.0.0 \
    pydantic-settings>=2.0.0 \
    sqlalchemy>=2.0.0 \
    asyncpg>=0.29.0 \
    alembic>=1.13.0 \
    pgvector>=0.3.0 \
    celery>=5.4.0 \
    redis>=5.0.0 \
    pymupdf>=1.24.0 \
    pdf2image>=1.17.0 \
    pydub>=0.25.1 \
    python-jose[cryptography]>=3.3.0 \
    passlib[bcrypt]>=1.7.4 \
    python-multipart>=0.0.9 \
    httpx>=0.27.0

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
