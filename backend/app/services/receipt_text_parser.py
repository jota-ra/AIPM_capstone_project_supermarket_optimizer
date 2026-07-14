"""
Offline receipt-text parser (E3 text fallback, no Gemini).

The "paste text" path is a genuine offline fallback: when a user types or
pastes receipt lines, we parse them with deterministic regex rules instead
of calling Gemini — so it works regardless of API quota/keys. Coarser than
the vision model, but reliable for typed text. The image path still uses
Gemini (receipt_parser.scan_receipt_bytes).

Produces the SAME structured shape as the Gemini parser (store, date,
items[name/quantity/unit/price/category/uncertain], non_food_items_ignored,
items_count), so everything downstream is identical.
"""

import re
from typing import Optional

from backend.app.services.fallback_categories import _canonical_category
from backend.app.services.units import normalize_unit, normalize_quantity

_STORES = {
    "rewe": "Rewe", "edeka": "Edeka", "aldi": "Aldi", "lidl": "Lidl",
    "penny": "Penny", "netto": "Netto", "norma": "Norma",
}

# Lines that are receipt scaffolding or non-food, never a grocery item.
_NONFOOD_KEYWORDS = (
    "pfand", "rabatt", "tüte", "tuete", "tragetasche", "beutel", "coupon",
    "leergut", "tasche",
)
_SKIP_KEYWORDS = (
    "summe", "total", "gesamt", "zwischensumme", "mwst", "ust", "steuer",
    "bar", "ec-", "ec ", "karte", "rückgeld", "rueckgeld", "kundenbeleg",
    "geg.", "eur", "datum", "uhrzeit", "beleg", "kasse", "vielen dank",
    # store header / address / footer lines
    "gmbh", "markt", "filiale", "straße", "strasse", "str.", "tel", "www", ".de",
    "rewe", "edeka", "aldi", "lidl", "penny", "netto", "norma", "uid", "steuernr",
)

# trailing price: "1,29", "1.29", "2,99 €", "3,50 EUR"
_PRICE_RE = re.compile(r"(\d{1,4}[.,]\d{2})\s*(?:€|eur)?\s*$", re.IGNORECASE)
# quantity + unit anywhere: "500g", "1,0 kg", "1L", "10 Stk", "6 x"
_QTY_RE = re.compile(
    r"(\d+(?:[.,]\d+)?)\s*(kg|gr|g|ml|ltr|l|stk|stück|stueck|st|x|pack|packung|dose|flasche|bund|cl)\b",
    re.IGNORECASE,
)
_DATE_DMY = re.compile(r"(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})")
_DATE_ISO = re.compile(r"(\d{4})-(\d{2})-(\d{2})")


def _to_float(s: str) -> Optional[float]:
    try:
        return float(s.replace(".", "").replace(",", ".")) if s.count(",") == 1 and "." in s \
            else float(s.replace(",", "."))
    except (TypeError, ValueError):
        return None


def _detect_store(lines) -> str:
    for line in lines[:6]:
        low = line.lower()
        for key, name in _STORES.items():
            if key in low:
                return name
    return "unknown"


def _detect_date(text: str) -> Optional[str]:
    m = _DATE_ISO.search(text)
    if m:
        return m.group(0)
    m = _DATE_DMY.search(text)
    if m:
        d, mth, y = m.groups()
        y = ("20" + y) if len(y) == 2 else y
        try:
            return f"{int(y):04d}-{int(mth):02d}-{int(d):02d}"
        except ValueError:
            return None
    return None


def parse_receipt_text_offline(raw_text: str) -> dict:
    """Parse pasted receipt text into the structured receipt schema — no LLM."""

    text = raw_text or ""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    store = _detect_store(lines)
    date = _detect_date(text)

    items = []
    non_food = []
    for line in lines:
        low = line.lower()
        if any(k in low for k in _SKIP_KEYWORDS):
            continue
        if any(k in low for k in _NONFOOD_KEYWORDS):
            non_food.append(line)
            continue
        if not re.search(r"[a-zäöüß]", low):
            continue  # no letters → not a product line

        price_m = _PRICE_RE.search(line)
        price = _to_float(price_m.group(1)) if price_m else None
        body = line[: price_m.start()].strip() if price_m else line

        qty_m = _QTY_RE.search(body)
        if qty_m:
            raw_qty = _to_float(qty_m.group(1)) or 1.0
            raw_unit = qty_m.group(2)
            # E3-S3: normalize to the canonical enum (L→l, Stk→piece, cl→ml…)
            quantity = normalize_quantity(raw_qty, raw_unit)
            unit = normalize_unit(raw_unit)
            name = (body[: qty_m.start()] + " " + body[qty_m.end():]).strip()
        else:
            quantity, unit, name = 1.0, "piece", body

        # strip leftover percentages / stray numbers from the name
        name = re.sub(r"\d+[.,]?\d*\s*%", "", name).strip(" -.,x")
        if not name or len(name) < 2:
            continue

        items.append({
            "name": name,
            "original_text": line,
            "quantity": quantity,
            "unit": unit,
            "price": price,
            "category": _canonical_category(None, name),
            "uncertain": qty_m is None,  # no explicit qty/unit → flag for review
        })

    return {
        "store": store,
        "date": date,
        "scan_quality": "good" if items else "poor",
        "items": items,
        "non_food_items_ignored": non_food,
        "items_count": len(items),
    }
