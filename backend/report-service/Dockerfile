FROM python:3.11-slim

WORKDIR /app

# WeasyPrint needs pango/cairo system libs; curl needed for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libglib2.0-0 \
        libffi-dev \
        shared-mime-info \
        fonts-liberation \
        fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Reports output directory (mounted as Docker volume in compose)
RUN mkdir -p /app/reports

EXPOSE 8007

CMD ["python", "app.py"]
