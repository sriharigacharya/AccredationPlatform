FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (before sentence-transformers pulls in CUDA torch)
RUN pip install --no-cache-dir torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
# Install remaining deps (torch already installed above, will be skipped or version-matched)
RUN grep -v "^torch" requirements.txt | pip install --no-cache-dir -r /dev/stdin

COPY . .

# NOTE: BGE-M3 (~580 MB) is downloaded at runtime on first request.
# Pre-download during build (optional, makes image larger but faster startup):
# RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"

EXPOSE 8005

CMD ["python", "app.py"]
