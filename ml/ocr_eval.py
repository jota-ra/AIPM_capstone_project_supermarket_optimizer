"""
OCR quality eval on the REAL receipt corpus (not the synthetic notebook image).

Runs the *production* extractor (backend/app/services/local_extractor.py) over
every real receipt file in data/receipts/ and measures how well the raw OCR text
recovers the hand-labelled line items in data/receipts/receipts_queries.json. This is
OCR *recall* — the ceiling for everything downstream (matching, nutrition). It
says nothing about the structured parser or the matching quality itself.

Use it as a regression guard: mean recall should stay high, and any receipt that
drops into the "LOW" bucket is an OCR problem worth eyeballing (start with its
dump in ml/ocr_raw_text/).

There is no filename -> receipt_id column in the labels, so each file is
auto-mapped to the receipt whose `name_original` items best survive in its OCR
text (item-overlap), and per item we ask: does the labelled `name_original`
fuzzy-appear somewhere in the OCR output?

History: this harness was written to diagnose 6 landscape phone photos that
OCR'd to pure noise (missing EXIF orientation). The confidence-based
orientation recovery that fixed them now lives in local_extractor._ocr, so this
eval reports the CURRENT production pipeline (fix included). Baseline back then
was 61.8% mean recall; with the fix it is ~93%.

Usage:
    .venv/bin/python3 ml/ocr_eval.py                 # report only (default)
    .venv/bin/python3 ml/ocr_eval.py --min-recall 0.80   # CI guard: exit 1 if
        # mean recall drops below the floor (used by .github/workflows/ocr-recall.yml)
Outputs:
    ml/ocr_eval_results.json   (structured per-file results)
    ml/ocr_raw_text/<file>.txt (raw OCR dump per file, for eyeballing)
"""

import argparse
import importlib.util
import json
import sys
from collections import defaultdict
from pathlib import Path

from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parents[1]
RECEIPTS_DIR = ROOT / "data" / "receipts"
LABELS = ROOT / "data" / "receipts" / "receipts_queries.json"
RAW_DIR = ROOT / "ml" / "ocr_raw_text"
OUT = ROOT / "ml" / "ocr_eval_results.json"

# Fuzzy threshold: an item counts as "recovered by OCR" if its labelled
# name_original scores >= this against the best-matching OCR window. 80 tolerates
# a couple of misread characters ("Milch"->"Mitch") without accepting noise.
FOUND_THRESHOLD = 80

# Per-file recall below this flags the receipt as an OCR problem to investigate.
LOW_RECALL = 0.60

IMAGE_PDF_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".pdf"}


def load_extractor():
    """Import the production extractor standalone (it has no internal imports)."""
    path = ROOT / "backend" / "app" / "services" / "local_extractor.py"
    spec = importlib.util.spec_from_file_location("local_extractor", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def best_score(needle: str, haystack: str) -> float:
    """Highest fuzzy score of `needle` against any line of the OCR text.
    partial_ratio handles the item name being a substring of a noisier OCR line
    (price columns, article numbers appended, etc.)."""
    needle = needle.upper().strip()
    if not needle:
        return 0.0
    best = 0.0
    for line in haystack.upper().splitlines():
        line = line.strip()
        if not line:
            continue
        best = max(best, fuzz.partial_ratio(needle, line))
        if best >= 100:
            break
    return best


def main(min_recall=None):
    extractor = load_extractor()
    labels = json.load(open(LABELS, encoding="utf-8"))

    # receipt_id -> list of labelled item names
    by_receipt = defaultdict(list)
    for e in labels:
        by_receipt[e["receipt_id"]].append(e["name_original"])

    def recall_for(text):
        """Auto-map: pick the receipt whose labelled items best survive in this
        OCR text; return (receipt_id, recall, found, missed)."""
        best = (None, -1.0, [], [])
        for rid, items in by_receipt.items():
            found, missed = [], []
            for name in items:
                (found if best_score(name, text) >= FOUND_THRESHOLD else missed).append(name)
            recall = len(found) / len(items) if items else 0.0
            if recall > best[1]:
                best = (rid, recall, found, missed)
        return best

    files = sorted(p for p in RECEIPTS_DIR.iterdir()
                   if p.suffix.lower() in IMAGE_PDF_SUFFIXES)
    RAW_DIR.mkdir(exist_ok=True)
    results = []

    print(f"{'file':<45} {'recall':>7}  {'receipt':>7}")
    print("-" * 70)
    for f in files:
        entry = {"file": f.name, "ocr_error": None, "matched_receipt": None,
                 "recall": None, "found": [], "missed": []}
        try:
            text = extractor.extract_text(f.read_bytes(), f.name)
        except Exception as e:
            entry["ocr_error"] = f"{e.__class__.__name__}: {e}"
            results.append(entry)
            print(f"{f.name:<45}   OCR FAILED: {entry['ocr_error']}")
            continue

        (RAW_DIR / (f.name + ".txt")).write_text(text, encoding="utf-8")
        rid, recall, found, missed = recall_for(text)
        entry.update(matched_receipt=rid, recall=round(recall, 3),
                     found=found, missed=missed)
        results.append(entry)
        flag = "  <== LOW" if recall < LOW_RECALL else ""
        print(f"{f.name:<45} {recall:>6.0%}  receipt {rid}{flag}")

    ok = [r for r in results if r["ocr_error"] is None]
    mean_recall = sum(r["recall"] for r in ok) / len(ok) if ok else 0.0
    low = [r["file"] for r in ok if r["recall"] < LOW_RECALL]

    print("\n" + "=" * 60)
    print(f"Files OCR'd:         {len(ok)}/{len(files)}")
    print(f"Mean item recall:    {mean_recall:.1%}")
    print(f"Low-recall receipts: {len(low)}  -> {low}")
    print(f"Raw text dumps:      {RAW_DIR.relative_to(ROOT)}/")
    print(f"Structured results:  {OUT.relative_to(ROOT)}")

    json.dump({"threshold": FOUND_THRESHOLD, "low_recall_cutoff": LOW_RECALL,
               "mean_recall": mean_recall, "low_recall_files": low, "files": results},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # Regression gate (CI). Without --min-recall this is a no-op, so local /
    # exploratory runs keep behaving as a pure report.
    if min_recall is not None and mean_recall < min_recall:
        print(f"\n::error::Mean OCR recall {mean_recall:.1%} is below the "
              f"{min_recall:.0%} floor — an OCR regression. Inspect the LOW "
              f"receipts' dumps in {RAW_DIR.relative_to(ROOT)}/.")
        return 1
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--min-recall", type=float, default=None,
        help="Fail (exit 1) if mean item recall drops below this 0..1 floor. "
             "Omit for a plain report.")
    args = parser.parse_args()
    sys.exit(main(min_recall=args.min_recall))
