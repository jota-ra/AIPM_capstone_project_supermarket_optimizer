# NutriWise backend.
#
# Uses a Docker runtime (not Render's native Python runtime) because local
# receipt OCR needs the system `tesseract` binary + German language model,
# which can't be installed via pip. See services/local_extractor.py.
FROM python:3.11-slim

# System dependencies:
#   tesseract-ocr, tesseract-ocr-deu → local OCR of image receipts (German)
#   libglib2.0-0                      → required by opencv-python-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-deu \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render provides $PORT at runtime; default to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
