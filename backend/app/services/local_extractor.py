"""
Local, offline receipt text extraction (E3) — replaces the Gemini vision call.

Motivation: the previous image path sent the raw receipt bytes to Gemini,
which (a) is rate-limited (429s), (b) exposes personal data — card PANs,
transaction IDs, PAYBACK numbers — to a third-party LLM, and (c) needs the
network. This module does the same job fully on-device: no API, no rate
limits, and no receipt data ever leaves the host.

Two engines, chosen by file type (validated end-to-end against real Lidl /
Netto / Edeka receipts in text_extraction.ipynb):

  • PDF   → embedded text layer via PyMuPDF (exact characters, instant).
            Scanned PDFs with no text layer fall back to rendering + OCR.
  • image → Tesseract OCR (German model) with OpenCV preprocessing
            (EXIF-fix → greyscale → upscale → adaptive threshold for photos).

The output is raw text; `receipt_text_parser.parse_receipt_text_offline`
turns it into the structured `ParsedReceipt` schema, so everything
downstream (matching, nutrition) is unchanged.
"""

import io
from pathlib import Path

import fitz  # PyMuPDF
import numpy as np
import pytesseract
from PIL import Image, ImageOps

# OpenCV gives the best photo preprocessing, but it is an optional heavy
# dependency. If it is missing we degrade to a Pillow-only pipeline so the
# service still runs (slightly lower OCR accuracy on noisy photos).
try:
    import cv2
    _HAVE_CV2 = True
except Exception:  # pragma: no cover - import guard
    _HAVE_CV2 = False


class UnreadableReceipt(Exception):
    """A file could not be turned into text (corrupt, unsupported, or no OCR
    engine available). The parser maps this to a typed ``invalid`` error so
    the API returns 422 instead of crashing."""


_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
_PHOTO_SUFFIXES = {".jpg", ".jpeg"}
_OCR_LANG = "deu"                 # German model — receipts are full of ä ö ü ß
_OCR_CONFIG = "--oem 1 --psm 6"   # LSTM engine, assume a single uniform block


def _tesseract_available() -> bool:
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _preprocess(pil_img: Image.Image, photo: bool) -> Image.Image:
    """Prepare an image for OCR: fix orientation, greyscale, upscale, and
    (for phone photos) denoise + adaptive-threshold to clean black-on-white."""

    img = ImageOps.exif_transpose(pil_img).convert("RGB")   # honour phone rotation

    if _HAVE_CV2:
        g = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
        scale = 2000 / g.shape[1]                            # upscale to ~2000px wide
        if scale > 1:
            g = cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        if photo:
            g = cv2.bilateralFilter(g, 7, 50, 50)
            g = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                      cv2.THRESH_BINARY, 31, 15)
        return Image.fromarray(g)

    # Pillow-only fallback (no OpenCV): greyscale + upscale.
    g = img.convert("L")
    w, h = g.size
    if w < 2000:
        f = 2000 / w
        g = g.resize((int(w * f), int(h * f)))
    return g


def _mean_conf(img: Image.Image) -> float:
    """Mean per-word OCR confidence for an image (ignores empty tokens and
    Tesseract's -1 non-text markers). Correctly-oriented text scores markedly
    higher than a rotated page, so this is the signal we pick orientation by."""
    d = pytesseract.image_to_data(img, lang=_OCR_LANG, config=_OCR_CONFIG,
                                  output_type=pytesseract.Output.DICT)
    confs = [int(c) for c, t in zip(d["conf"], d["text"])
             if str(c) != "-1" and t.strip()]
    return sum(confs) / len(confs) if confs else 0.0


def _ocr(pil_img: Image.Image, photo: bool) -> str:
    if not _tesseract_available():
        raise UnreadableReceipt(
            "OCR engine (Tesseract) is not installed on this host — "
            "image receipts cannot be read. Install tesseract-ocr + "
            "tesseract-ocr-deu (see Dockerfile)."
        )
    prepped = _preprocess(pil_img, photo)

    # Confidence-based 90° orientation recovery. Phone photos of receipts are
    # often landscape with a *normal* (or missing) EXIF orientation tag, so
    # exif_transpose leaves them rotated and OCR returns pure noise. Tesseract's
    # OSD is unreliable on faint thermal print, so we brute-force the four 90°
    # orientations and keep the one with the highest mean word confidence.
    # Photos only — flat app exports / rendered PDFs are already upright and
    # skipping the search keeps them at a single OCR pass.
    if photo:
        best_img, best_conf = prepped, _mean_conf(prepped)
        for deg in (90, 180, 270):
            cand = prepped.rotate(deg, expand=True)
            conf = _mean_conf(cand)
            if conf > best_conf:
                best_conf, best_img = conf, cand
        prepped = best_img

    return pytesseract.image_to_string(prepped, lang=_OCR_LANG, config=_OCR_CONFIG)


def _pdf_text(file_bytes: bytes) -> str:
    """Read a PDF's embedded text layer; OCR the rendered pages only if there
    is no text layer (i.e. a scanned PDF)."""

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = "\n".join(page.get_text() for page in doc)
    if text.strip():
        return text
    pages = []
    for page in doc:
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        pages.append(_ocr(img, photo=False))
    return "\n".join(pages)


def extract_text(file_bytes: bytes, filename: str | None) -> str:
    """Turn an uploaded receipt (PDF or image bytes) into raw text, fully
    offline. Raises :class:`UnreadableReceipt` on unsupported / corrupt input."""

    suffix = Path(filename or "").suffix.lower()
    try:
        if suffix == ".pdf":
            return _pdf_text(file_bytes)
        if suffix in _IMAGE_SUFFIXES or suffix == "":
            img = Image.open(io.BytesIO(file_bytes))
            w, h = img.size
            # A large JPEG is almost certainly a phone photo → heavier pipeline;
            # a small/flat PNG or app export is already clean.
            is_photo = suffix in _PHOTO_SUFFIXES and max(w, h) > 2500
            return _ocr(img, photo=is_photo)
        raise UnreadableReceipt(f"Unsupported receipt file type: {suffix or 'unknown'}")
    except UnreadableReceipt:
        raise
    except Exception as e:  # corrupt bytes, bad PDF, decode failure, …
        raise UnreadableReceipt(f"Could not read receipt file: {e}") from e
