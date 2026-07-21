"""
Conflict detection: purchased items that don't match the profile.

If a self-described vegan's receipts show meat, that's worth surfacing
as a question ("did this change, or was it for someone else?"), not
silently ignored or silently "corrected" — the analysis never changes
the profile on its own, it only flags the mismatch for the user to
resolve (see api/nutrition.py, which returns these alongside the gaps,
and the frontend prompt that lets the user either update their profile
or dismiss it as a one-off).

Reuses exclusion_filter.py's check_candidate() wholesale — it already
knows how to compare a name+tags pair against dietary pattern, allergies
and dislikes; the only new piece here is deriving tags for a purchased
item name, since receipt items (unlike recommendation candidates) don't
come with curated tags.
"""

import re
from typing import List, Optional, Union

from backend.app.db.supabase import get_receipt_items_by_user
from backend.app.models.conflict import Conflict
from backend.app.models.profile import Profile, ProfileCreate
from backend.app.services.exclusion_filter import ExclusionCandidate, check_candidate

ProfileLike = Union[Profile, ProfileCreate]

# German name keywords -> the tag vocabulary DIETARY_PATTERN_EXCLUDED_TAGS
# uses (exclusion_filter.py). Deliberately finer-grained than
# fallback_categories.py's coarse protein/dairy/etc. buckets — conflict
# detection needs to tell meat apart from fish apart from eggs, not just
# lump them into one "protein" bucket the way the nutrition-density path
# does.
_CONFLICT_KEYWORDS = {
    "meat": [
        "fleisch", "wurst", "schnitzel", "salami", "schinken", "hähnchen",
        "huhn", "rind", "schwein", "speck", "hackfleisch", "geflügel",
        "pute", "leberwurst", "hendl", "steak",
    ],
    "fish": ["fisch", "lachs", "thunfisch", "garnelen", "forelle", "hering", "makrele", "kabeljau"],
    "dairy": ["milch", "käse", "joghurt", "quark", "sahne", "butter", "frischkäse", "mozzarella", "parmesan", "molke"],
    "eggs": ["ei", "eier"],
    "honey": ["honig"],
    "gluten": ["weizen", "gerste", "roggen", "dinkel", "brot", "brötchen", "nudel", "nudeln", "kuchen", "gebäck"],
}


def _tags_for_name(name: str) -> set:
    """Same tokenize-and-match approach as fallback_categories.py's
    keyword lookup, but returning every matching tag (a product can be
    both, e.g. "Schinken-Käse-Brot" is meat+dairy+gluten) instead of one
    canonical category."""

    name_l = (name or "").lower()
    tokens = set(re.findall(r"[a-zäöüß]+", name_l))
    tags = set()
    for tag, keywords in _CONFLICT_KEYWORDS.items():
        for kw in keywords:
            # Short keywords ("ei") only match a whole word so they don't
            # fire inside unrelated words; longer ones may match as
            # substrings to catch German compounds ("käse" in "frischkäse").
            if kw in tokens or (len(kw) >= 4 and kw in name_l):
                tags.add(tag)
                break
    return tags


def detect_conflicts(user_id: str, profile: Optional[ProfileLike], lang: str = "en") -> List[Conflict]:
    """
    Every purchased item (across this session's receipts) that conflicts
    with the profile's dietary pattern, allergies, or dislikes — [] if
    there's no profile to check against. Deduplicated by item name so a
    repeatedly-bought conflicting item is only surfaced once.
    """

    if profile is None:
        return []

    items = get_receipt_items_by_user(user_id)
    seen_names = set()
    conflicts: List[Conflict] = []

    for item in items:
        name = item.get("normalized_name") or item.get("raw_name")
        if not name or name in seen_names:
            continue

        # Bug fix: this used to skip any item with no matched diet tag
        # (meat/fish/dairy/...) before ever checking it — but
        # check_candidate's allergy/dislike matching also compares the
        # NAME directly (see _match_free_text_list), independent of
        # tags. Skipping here meant e.g. "Erdnussmus" (peanut butter)
        # was never flagged against a peanut allergy, since it has no
        # diet-pattern tag at all. Always check; an empty tag set just
        # means the dietary-pattern check has nothing to match against.
        tags = _tags_for_name(name)
        result = check_candidate(profile, ExclusionCandidate(name=name, tags=list(tags)), lang)
        if result.allowed:
            continue

        seen_names.add(name)
        conflicts.append(Conflict(
            item=name,
            blocked_by=result.blocked_by,
            blocked_by_type=result.blocked_by_type,
            message=result.reason,
        ))

    return conflicts
