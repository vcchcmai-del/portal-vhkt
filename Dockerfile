# CNCT HCM Portal - SINGLE SERVICE DEPLOYMENT
# IMPORTANT: This is the ONLY Dockerfile intended for PaaS deployment.
# FastAPI/Uvicorn serves both /api/* and the prebuilt frontend.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATA_DIR=/app/data \
    PORTAL_BUILD=STABLE-PG-ICONS-20260808

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/app /app/app
COPY backend/reset_password.py /app/reset_password.py
COPY backend/static /app/static

RUN mkdir -p /app/data

EXPOSE 8000

# One process only. No nginx, no gunicorn, no reload, no extra workers.
CMD ["python", "-m", "app.server"]
