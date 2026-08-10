# CNCT HCM Portal - Backend container
# This Dockerfile is intentionally under backend/ because the hosting
# platform builds the service from ./backend (as shown in its Stage 4 log).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATA_DIR=/app/data \
    PORTAL_BUILD=STABLE-PG-ICONS-20260808

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app/app
COPY static /app/static
COPY reset_password.py /app/reset_password.py

RUN mkdir -p /app/data

EXPOSE 8000

# Exactly one process. No nginx, gunicorn, reload, or extra workers.
CMD ["python", "-m", "app.server"]
