"""
Easy swap suggestions: low-effort, cheap, in-season additions/swaps
across every flagged gap — a supplementary list alongside the single,
deliberate Next Cart pick (recommender.py). Rule-based, reusing the same
candidate table (data/recommendations.json) and exclusion filter as Next
Cart; nothing here is a new fact, just a broader selection over the same
data, favoring effort/cost/season the single Next Cart pick doesn't
consider.
"""

from typing import List, Optional, Union

from backend.app.models.next_cart import EasySwap
from backend.app.models.profile import Profile, ProfileCreate
from backend.app.models.snapshot import Gap
from backend.app.services.exclusion_filter import ExclusionCandidate, check_candidate
from backend.app.services.recommender import RECOMMENDATIONS, default_profile
from backend.app.services import i18n

ProfileLike = Union[Profile, ProfileCreate]

MAX_EASY_SWAPS = 5


def _in_season(season, month: int) -> bool:
    if season == "all" or season is None:
        return True
    return month in season


def suggest_easy_swaps(
    gaps: List[Gap],
    profile: Optional[ProfileLike],
    month: int,
    limit: int = MAX_EASY_SWAPS,
    lang: str = "en",
) -> List[EasySwap]:
    """
    Up to `limit` low-effort candidates across every flagged gap (not
    just the top one recommender.py picks), deduplicated by item name,
    filtered by the same exclusion rules as Next Cart and by whether the
    item is in season this month.
    """

    if profile is None:
        profile = default_profile()

    seen_items = set()
    swaps: List[EasySwap] = []

    for gap in gaps:
        candidates = RECOMMENDATIONS.get(f"{gap.dimension}:{gap.status.value}", [])
        for candidate in candidates:
            if candidate.get("effort") != "low":
                continue
            if candidate["item"] in seen_items:
                continue
            if not _in_season(candidate.get("season"), month):
                continue

            check = check_candidate(
                profile,
                ExclusionCandidate(name=candidate["item"], tags=candidate["tags"]),
                lang,
            )
            if not check.allowed:
                continue

            seen_items.add(candidate["item"])
            swaps.append(EasySwap(
                item=candidate["item"],
                targets_gap=gap.dimension,
                cost=candidate.get("cost", "medium"),
                rationale=i18n.rationale_for(candidate, lang),
            ))
            if len(swaps) >= limit:
                return swaps

    return swaps
