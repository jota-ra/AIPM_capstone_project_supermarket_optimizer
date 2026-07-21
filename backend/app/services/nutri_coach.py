"""
Nutri-Coach: a warm, conversational voice wrapped around the already-
computed gap/recommendation/progress data — NOT a new source of
nutrition facts.

The LLM's only job is phrasing. Every number and food name in the coach
message must come from the structured `context` dict passed in; the
system prompt explicitly forbids inventing anything beyond it. If the
call fails for any reason (rate limit, network, missing key, empty
response), a rule-based template takes over instead — same "a
should-have feature must not break the core flow" stance as
recipe_suggester.py and recommender.py's recommendations.json loader.
"""

import hashlib
import json
import os
import time
from collections import OrderedDict
from typing import Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types

from backend.app.core.config import settings
from backend.app.services import i18n

# Loaded here too (not just receipt_parser.py) so this module doesn't
# implicitly depend on receipt_parser having been imported first to
# populate GEMINI_API_KEY into os.environ — load_dotenv() is idempotent.
load_dotenv()

MODEL = "gemini-2.5-flash"

# Lazily-constructed singleton client. Lazy (not at import) so the module
# imports fine when the coach LLM is disabled or GEMINI_API_KEY is absent
# (previously the module hard-crashed at import on a missing key). One
# client for the process lifetime — the SDK's client isn't meant to be
# reconstructed per call.
_client: Optional[genai.Client] = None


def _get_client() -> Optional[genai.Client]:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return None
        _client = genai.Client(api_key=api_key)
    return _client


# ── Result cache (#4) ────────────────────────────────────────────────────
# The coach message is a pure function of the computed facts in `context`
# (+ language) — no timestamps or random ids — so identical inputs always
# warrant the identical message. Caching successful LLM messages by a hash
# of those inputs means repeated Overview loads / refreshes, the React
# StrictMode double-render, and the Overview+Notifications overlap all reuse
# one message instead of each spending a Gemini request. Bounded LRU so it
# can't grow without limit.
_CACHE_MAX = 256
_cache: "OrderedDict[str, str]" = OrderedDict()

# ── Rate-limit cooldown (#2) ─────────────────────────────────────────────
# After a quota/429 error, stop calling Gemini for a short window and serve
# the template directly — turns a burst of identical 429s (one per refresh)
# into a single logged line, and avoids hammering an API we know is capped.
_COOLDOWN_SECONDS = 90.0
_rate_limited_until = 0.0


def _cache_key(context: dict, language: str) -> str:
    blob = json.dumps({**context, "language": language}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _is_rate_limit(exc: Exception) -> bool:
    msg = str(exc)
    return "RESOURCE_EXHAUSTED" in msg or "429" in msg

SYSTEM_PROMPT = """You are NutriWise's Nutri-Coach: a warm, encouraging, concise nutrition coach.

You will be given a JSON object with facts ALREADY COMPUTED by a rule-based
nutrition engine: a health score, flagged gaps, one shopping recommendation,
a few easy swap ideas, and (if available) week-over-week progress.

STRICT RULES:
- Use ONLY the facts given in the JSON. Do not invent, estimate, or add any
  nutrient values, foods, health claims, or numbers not present in the input.
- Never give medical advice or diagnose anything.
- If a field is missing, null, or an empty list, simply don't mention it —
  never guess or fill in a plausible-sounding placeholder.
- Keep it to 3-5 short sentences: acknowledge the status quo, name what to
  cut back on and what to add (only from the given data), end with one
  encouraging, actionable note.
- Write in the language given by "language" ("de" = German, "en" = English).
- Plain conversational prose — no headers, no bullet points, no markdown.
"""


def _fallback_message(context: dict, lang: str = "en") -> str:
    """
    Rule-based template used whenever the Gemini call fails — built from
    the exact same `context` facts, so the coach voice is never just
    missing, and never says anything the LLM path couldn't also say.
    Localized (E13) so the fallback matches the user's language too.
    """

    parts = []

    health_score = context.get("health_score")
    if health_score:
        label_key = str(health_score.get("label", ""))
        label = i18n.t(lang, f"hslabel.{label_key}")
        parts.append(i18n.t(lang, "coach.score", value=health_score.get("value"), label=label))

    top_gaps = context.get("top_gaps") or []
    if top_gaps:
        names = i18n.join_nutrients(lang, [g["dimension"] for g in top_gaps])
        parts.append(i18n.t(lang, "coach.attention", names=names))

    recommendation = context.get("recommendation") or {}
    if recommendation.get("item"):
        parts.append(i18n.t(lang, "coach.try", item=recommendation["item"]))

    easy_swaps = context.get("easy_swaps") or []
    if easy_swaps:
        parts.append(i18n.t(lang, "coach.easy_start", item=easy_swaps[0]["item"]))

    progress_trend = context.get("progress_trend")
    if progress_trend and progress_trend != "insufficient_data":
        trend_word = i18n.t(lang, f"coach.trend.{progress_trend}")
        parts.append(i18n.t(lang, "coach.trend", trend=trend_word))

    if not parts:
        return i18n.t(lang, "coach.empty")

    return " ".join(parts)


def generate_coach_message(context: dict, language: str = "en") -> str:
    """
    `context` should be a small, plain-JSON-serializable dict of already-
    computed facts (see api/recommendations.py for what's passed) —
    never raw profile data or anything not meant to be phrased back to
    the user.

    Order of preference: cached LLM message → live LLM call → rule-based
    template. The template is always a safe, correct fallback (never says
    anything the LLM path couldn't), so the coach voice is never missing.
    """

    global _rate_limited_until

    # #3 config gate: LLM off → template only, no client, no Gemini call.
    if not settings.COACH_LLM_ENABLED:
        return _fallback_message(context, language)

    key = _cache_key(context, language)
    cached = _cache.get(key)
    if cached is not None:
        _cache.move_to_end(key)  # LRU touch
        return cached

    # #2 cooldown: inside the post-429 window, don't call Gemini at all.
    if time.monotonic() < _rate_limited_until:
        return _fallback_message(context, language)

    client = _get_client()
    if client is None:
        # No API key configured — behave exactly like "LLM disabled".
        return _fallback_message(context, language)

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=[json.dumps({**context, "language": language}, ensure_ascii=False)],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.4,
            ),
        )
        text = (response.text or "").strip()
        if not text:
            return _fallback_message(context, language)
        # Cache only successful LLM messages (bounded LRU). Template
        # fallbacks are deliberately NOT cached, so the LLM is retried once
        # quota resets rather than a template being pinned in place.
        _cache[key] = text
        _cache.move_to_end(key)
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)
        return text
    except Exception as e:
        # #2 quiet logging: one concise line, not the full error JSON dump.
        if _is_rate_limit(e):
            _rate_limited_until = time.monotonic() + _COOLDOWN_SECONDS
            print(
                f"[nutri_coach] Gemini quota reached — using the rule-based coach "
                f"for the next {int(_COOLDOWN_SECONDS)}s."
            )
        else:
            print(f"[nutri_coach] Gemini unavailable ({type(e).__name__}) — using the rule-based coach.")
        return _fallback_message(context, language)
