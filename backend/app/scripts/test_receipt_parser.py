"""
Quick manual test for the receipt parser (no server / DB needed).

Usage (run from the repo root):
    python -m backend.app.scripts.test_receipt_parser <image_or_pdf_path>
    python -m backend.app.scripts.test_receipt_parser --text <text_file_path>

Fully local — no API key needed. Image/PDF extraction uses the on-device
engines (Tesseract OCR + PyMuPDF); the image path requires the tesseract
binary (+ German model) to be installed.
"""

import json
import sys
from pathlib import Path

from backend.app.services.receipt_parser import (
    scan_receipt_bytes,
    scan_receipt_text,
)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        raise SystemExit(1)

    if args[0] == "--text":
        if len(args) < 2:
            print("Missing text file path after --text")
            raise SystemExit(1)
        raw_text = Path(args[1]).read_text(encoding="utf-8")
        result = scan_receipt_text(raw_text=raw_text)
    else:
        path = Path(args[0])
        file_bytes = path.read_bytes()
        result = scan_receipt_bytes(file_bytes=file_bytes, filename=path.name)

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
