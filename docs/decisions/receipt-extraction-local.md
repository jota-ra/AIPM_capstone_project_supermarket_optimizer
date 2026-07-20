---
name: receipt-extraction-local
description: Receipt text extraction is now fully local (Tesseract + PyMuPDF); Gemini removed from the receipt path
metadata:
  type: project
---

Receipt extraction (Epic 3) was migrated OFF Gemini Vision to a fully local, offline pipeline on 2026-07-14, to eliminate rate limits (429s) and stop sending personal receipt data (card PANs, transaction IDs, PAYBACK numbers) to a third-party LLM.

**Architecture now:**
- `services/local_extractor.py` (new) — bytes → raw text. PDF via PyMuPDF text layer (exact; OCR fallback for scanned PDFs); images via Tesseract OCR (German `deu`) + OpenCV preprocessing (EXIF-fix → greyscale → upscale → adaptive threshold for photos). Raises `UnreadableReceipt` on bad input.
- `services/receipt_text_parser.py` — now the SINGLE parser for all inputs (pasted text, OCR, PDF). Auto-detects **inline** layout (price at line end; tills/OCR/pasted) vs **block** layout (price on next line; eBon PDFs like Netto). Inline parser is OCR-robust: tolerates trailing tax-class letters on prices (`2,35 A`), stops at the totals block, filters TSE/payment noise, handles `x N` multipliers and weighed-goods lines.
- `services/receipt_parser.py` — `scan_receipt_bytes` calls local_extractor then the parser. Gemini client/prompt/schema removed. Kept: MOCK_MODE, `_normalize_parsed`, error codes. Only `ERROR_INVALID` is emitted now (no rate limits). Module no longer needs GEMINI_API_KEY at import.

**Validated** against real receipts: Netto PDF 10/10 exact, Lidl PNG 15/15, Edeka photo 8 items (names garbled by OCR — expected; the [[verified-match feedback loop]] via `/receipts/{id}/items/{id}/match` learns per-store corrections at conf 1.0).

**Deployment implication:** Tesseract is a system binary, so `render.yaml` was switched from `runtime: python` to `runtime: docker` with a new root `Dockerfile` (installs `tesseract-ocr`, `tesseract-ocr-deu`, `libglib2.0-0`). requirements.txt adds pymupdf/pytesseract/pillow/opencv-python-headless/numpy.

**Scope:** Gemini (`google-genai`) is STILL used by `services/nutri_coach.py` — only the receipt path was changed. Reference experiments: `text_extraction.ipynb` at repo root.
