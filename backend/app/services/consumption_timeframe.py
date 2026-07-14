"""
Consumption-timeframe engine (E6-S3 / BR-T1..T3).

Estimates how many days a purchased item is consumed over, so one big shop
isn't read as a single day's eating. Ordered logic:

  BR-T1  category default window (produce 3-7 d … pantry staple 60-90 d)
  BR-T2  refine: with ≥2 purchases of the same product, use the mean of the
         last 3 inter-purchase intervals (keyed by matched_product_id, else
         raw_text+store)
  BR-T3  correct: eaten/left/thrown feedback adjusts the remaining quantity
         — the hook is here but only fires once Epic 10 supplies feedback

Windows are computed on-the-fly from the receipt history (no separate
table). Pure/rule-based and unit-testable.
"""

from typing import List, Optional

from backend.app.services.fallback_categories import _canonical_category

# BR-T1 default consumption window (days) per canonical category — midpoints
# of the PRD's ranges (produce 3-7→5, dairy 7-10→8, staple 60-90→75).
_CATEGORY_WINDOW_DAYS = {
    "fruit": 5,
    "vegetable": 5,
    "dairy": 8,
    "protein": 5,
    "grain": 75,     # pantry staple
    "snack": 30,
    "drink": 14,
    "other": 14,
}
_DEFAULT_WINDOW_DAYS = 14


def default_window(category: Optional[str], name: Optional[str] = None) -> int:
    """BR-T1: category default consumption window in days."""

    canonical = _canonical_category(category, name or "")
    return _CATEGORY_WINDOW_DAYS.get(canonical, _DEFAULT_WINDOW_DAYS)


def _intervals(sorted_dates: List) -> List[float]:
    return [
        (sorted_dates[i] - sorted_dates[i - 1]).days
        for i in range(1, len(sorted_dates))
        if (sorted_dates[i] - sorted_dates[i - 1]).days > 0
    ]


def refined_window(purchase_dates: List, category: Optional[str] = None, name: Optional[str] = None) -> int:
    """
    BR-T2: with ≥2 purchases of the same product, the window is the mean of
    the last 3 inter-purchase intervals. Fewer than two usable intervals →
    fall back to the category default (BR-T1).

    `purchase_dates` is a list of datetime.date/datetime for one product.
    """

    dates = sorted(d for d in purchase_dates if d is not None)
    intervals = _intervals(dates)
    if len(intervals) < 1:
        return default_window(category, name)
    last3 = intervals[-3:]
    return max(1, round(sum(last3) / len(last3)))


def window_for(category: Optional[str], name: Optional[str] = None, purchase_dates: Optional[List] = None) -> int:
    """Resolve the consumption window for an item: refined if enough repeat
    purchases exist, else the category default."""

    if purchase_dates and len([d for d in purchase_dates if d is not None]) >= 2:
        return refined_window(purchase_dates, category, name)
    return default_window(category, name)
