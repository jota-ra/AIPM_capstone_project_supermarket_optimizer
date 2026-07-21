"""
Backend localization (E13 / C-1 / R-LANG) — DE/EN.

Single source of truth for every user-facing string the backend composes:
message templates, nutrient/dimension display names, and action verbs. The
frontend renders these strings verbatim, so they must already be in the
user's language by the time they leave the API.

Design:
  - `t(lang, key, **params)` looks up a template in `_MESSAGES` and fills
    placeholders. Unknown key → the key itself (fails visibly, never crashes).
  - Composed sentences are written as *full* localized templates (numbers /
    food names as placeholders) rather than stitched from fragments, so each
    language reads naturally instead of word-for-word.
  - `nutrient(lang, key)` / `join_nutrients(lang, keys)` localize the raw
    dimension keys ("fiber" → "Ballaststoffe") for the few places that
    interpolate them (health-score summary, pantry/gap references).

`lang` is threaded from the request (`?lang=`) down through the services;
it always defaults to "en" so any un-threaded path degrades to English
rather than breaking.
"""

from typing import List

Lang = str  # "en" | "de"

_DEFAULT: Lang = "en"


def _norm(lang) -> Lang:
    lang = (lang.value if hasattr(lang, "value") else lang) or _DEFAULT
    lang = str(lang).lower()
    return "de" if lang.startswith("de") else "en"


# ── Nutrient / dimension display names ───────────────────────────────────
NUTRIENT_NAMES = {
    "fiber": {"en": "fiber", "de": "Ballaststoffe"},
    "protein": {"en": "protein", "de": "Protein"},
    "sugar": {"en": "sugar", "de": "Zucker"},
    "carbs": {"en": "carbs", "de": "Kohlenhydrate"},
    "fat": {"en": "fat", "de": "Fett"},
    "saturated_fat": {"en": "saturated fat", "de": "gesättigte Fettsäuren"},
    "calories": {"en": "calories", "de": "Kalorien"},
    "processed": {"en": "processed foods", "de": "verarbeitete Lebensmittel"},
    "iron": {"en": "iron", "de": "Eisen"},
    "calcium": {"en": "calcium", "de": "Calcium"},
    "magnesium": {"en": "magnesium", "de": "Magnesium"},
    "potassium": {"en": "potassium", "de": "Kalium"},
    "sodium": {"en": "sodium", "de": "Natrium"},
}


def nutrient(lang, key: str) -> str:
    lang = _norm(lang)
    entry = NUTRIENT_NAMES.get(key)
    return entry[lang] if entry else key


def join_nutrients(lang, keys: List[str]) -> str:
    """Localized comma list with a trailing 'and'/'und'."""
    lang = _norm(lang)
    names = [nutrient(lang, k) for k in keys]
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    conj = " und " if lang == "de" else " and "
    return ", ".join(names[:-1]) + conj + names[-1]


# ── Action verbs (recommendation action_type → display verb) ─────────────
_ACTIONS = {
    "add": {"en": "Add", "de": "Hinzufügen"},
    "replace": {"en": "Replace", "de": "Ersetzen"},
    "reduce": {"en": "Reduce", "de": "Reduzieren"},
}


def action_verb(lang, action_type: str) -> str:
    lang = _norm(lang)
    entry = _ACTIONS.get((action_type or "").lower())
    return entry[lang] if entry else (action_type or "").capitalize()


def rationale_for(candidate: dict, lang) -> str:
    """Pick the localized rationale from a recommendations.json candidate
    (German `rationale_de` when present, else the English `rationale`)."""
    lang = _norm(lang)
    if lang == "de":
        return candidate.get("rationale_de") or candidate.get("rationale") or ""
    return candidate.get("rationale") or ""


# ── Message catalog ──────────────────────────────────────────────────────
# Keys are grouped by source. `{...}` placeholders are filled by t().
_MESSAGES = {
    # nutrition_model.py
    "disclaimer": {
        "en": ("Estimated from your grocery purchases, not your actual intake. "
               "Receipts can't capture meals eaten out, shared food, or what you "
               "actually ate. This is not medical advice."),
        "de": ("Geschätzt aus deinen Einkäufen, nicht aus deinem tatsächlichen Verzehr. "
               "Kassenbons erfassen keine auswärts gegessenen Mahlzeiten, geteiltes Essen "
               "oder was du wirklich gegessen hast. Dies ist keine medizinische Beratung."),
    },
    "wtm.fiber": {
        "en": ("Fiber comes from whole grains, legumes, fruit and vegetables; "
               "a higher share generally points to a more balanced basket."),
        "de": ("Ballaststoffe stammen aus Vollkorn, Hülsenfrüchten, Obst und Gemüse; "
               "ein höherer Anteil deutet meist auf einen ausgewogeneren Warenkorb hin."),
    },
    "wtm.protein": {
        "en": "Reflects how protein-dense your purchases are, relative to their calories.",
        "de": "Zeigt, wie proteinreich deine Einkäufe im Verhältnis zu ihren Kalorien sind.",
    },
    "wtm.sugar": {
        "en": ("The estimated share of your basket's calories that comes from "
               "sugar (based on total sugars)."),
        "de": ("Der geschätzte Anteil der Kalorien deines Warenkorbs, der aus "
               "Zucker stammt (basierend auf Gesamtzucker)."),
    },
    "wtm.calories": {
        "en": "A rough estimate of the total food energy in the groceries analysed.",
        "de": "Eine grobe Schätzung des gesamten Energiegehalts der analysierten Einkäufe.",
    },
    "wtm.processed": {
        "en": ("How processed your basket leans, on a 1 (whole foods) to 4 "
               "(ultra-processed) scale."),
        "de": ("Wie verarbeitet dein Warenkorb tendenziell ist, auf einer Skala von 1 "
               "(unverarbeitet) bis 4 (hochverarbeitet)."),
    },
    "unit.g_per_1000kcal": {"en": "g per 1000 kcal", "de": "g pro 1000 kcal"},
    "unit.pct_energy": {"en": "% of energy", "de": "% der Energie"},
    "unit.nova": {"en": "avg NOVA (1-4)", "de": "Ø NOVA (1-4)"},
    "unit.kcal_basket": {"en": "kcal (basket total, estimated)", "de": "kcal (Warenkorb gesamt, geschätzt)"},

    # gap_detector.py (density gaps) — numbers only
    "gap.fiber": {
        "en": ("Your basket is low in fiber (~{value:.0f} g per 1000 kcal vs a "
               "~{ref:.0f} g guideline). More whole grains, legumes, fruit or "
               "vegetables would help."),
        "de": ("Dein Warenkorb enthält wenig Ballaststoffe (~{value:.0f} g pro 1000 kcal "
               "ggü. einem Richtwert von ~{ref:.0f} g). Mehr Vollkorn, Hülsenfrüchte, "
               "Obst oder Gemüse würden helfen."),
    },
    "gap.protein": {
        "en": ("Protein is on the low side (~{value:.0f} g per 1000 kcal). Beans, "
               "dairy, eggs, fish or lean meat would round it out."),
        "de": ("Protein ist eher niedrig (~{value:.0f} g pro 1000 kcal). Bohnen, "
               "Milchprodukte, Eier, Fisch oder mageres Fleisch würden es ergänzen."),
    },
    "gap.sugar": {
        "en": ("Sugar makes up a high share of your basket's calories (~{value:.0f}% "
               "of energy). Cutting back on sweetened drinks and snacks would lower it."),
        "de": ("Zucker macht einen hohen Anteil der Kalorien deines Warenkorbs aus "
               "(~{value:.0f}% der Energie). Weniger gesüßte Getränke und Snacks würden "
               "ihn senken."),
    },
    "gap.processed": {
        "en": ("Your basket leans heavily processed (avg {value:.1f} on a 1-4 scale). "
               "Swapping some ready-made items for whole foods would help."),
        "de": ("Dein Warenkorb ist stark verarbeitet (Ø {value:.1f} auf einer Skala von "
               "1-4). Einige Fertigprodukte durch unverarbeitete Lebensmittel zu ersetzen, "
               "würde helfen."),
    },

    # absolute_gap_detector.py (Bedarf vs. Ist)
    "abs.iron": {
        "en": ("Based on what you've confirmed eating, you're getting ~{estimate:.1f} mg "
               "iron/day vs. a ~{requirement:.0f} mg/day guideline. Iron-rich foods like "
               "lentils, spinach or lean red meat would help close the gap."),
        "de": ("Basierend auf dem, was du bestätigt hast, nimmst du ~{estimate:.1f} mg "
               "Eisen/Tag auf ggü. einem Richtwert von ~{requirement:.0f} mg/Tag. "
               "Eisenreiche Lebensmittel wie Linsen, Spinat oder mageres rotes Fleisch "
               "würden die Lücke schließen."),
    },
    "abs.protein": {
        "en": ("Based on what you've confirmed eating, you're getting ~{estimate:.0f} g "
               "protein/day vs. a ~{requirement:.0f} g/day guideline. Greek yogurt, tofu, "
               "lentils or eggs would help close the gap."),
        "de": ("Basierend auf dem, was du bestätigt hast, nimmst du ~{estimate:.0f} g "
               "Protein/Tag auf ggü. einem Richtwert von ~{requirement:.0f} g/Tag. "
               "Griechischer Joghurt, Tofu, Linsen oder Eier würden die Lücke schließen."),
    },
    "abs.calcium": {
        "en": ("Based on what you've confirmed eating, you're getting ~{estimate:.0f} mg "
               "calcium/day vs. a ~{requirement:.0f} mg/day guideline. Dairy, fortified "
               "plant milk, tofu or leafy greens would help close the gap."),
        "de": ("Basierend auf dem, was du bestätigt hast, nimmst du ~{estimate:.0f} mg "
               "Calcium/Tag auf ggü. einem Richtwert von ~{requirement:.0f} mg/Tag. "
               "Milchprodukte, angereicherte Pflanzendrinks, Tofu oder grünes Blattgemüse "
               "würden die Lücke schließen."),
    },
    "abs.calories_low": {
        "en": ("You're eating ~{estimate:.0f} kcal/day, noticeably below your "
               "~{target:.0f} kcal/day target. If that's not intentional, adding a snack "
               "or a bigger portion could help."),
        "de": ("Du isst ~{estimate:.0f} kcal/Tag, deutlich unter deinem Ziel von "
               "~{target:.0f} kcal/Tag. Falls das nicht beabsichtigt ist, könnten ein "
               "Snack oder eine größere Portion helfen."),
    },
    "abs.calories_high": {
        "en": ("You're eating ~{estimate:.0f} kcal/day, noticeably above your "
               "~{target:.0f} kcal/day target. Cutting back on energy-dense snacks or "
               "drinks could help."),
        "de": ("Du isst ~{estimate:.0f} kcal/Tag, deutlich über deinem Ziel von "
               "~{target:.0f} kcal/Tag. Weniger energiedichte Snacks oder Getränke "
               "könnten helfen."),
    },

    # recommender.py (legacy Next Cart)
    "rec.pantry_expired": {
        "en": "Your {item} is past its estimated shelf life — use it now or toss it. It also helps your {nutrient} gap.",
        "de": "Dein/e {item} ist über die geschätzte Haltbarkeit hinaus — jetzt verbrauchen oder wegwerfen. Es hilft außerdem bei deiner {nutrient}-Lücke.",
    },
    "rec.pantry_expiring": {
        "en": "Your {item} is expiring soon — use it up, and it helps your {nutrient} gap too.",
        "de": "Dein/e {item} läuft bald ab — verbrauche es, und es hilft außerdem bei deiner {nutrient}-Lücke.",
    },
    "rec.pantry_have": {
        "en": "You already have {item} in your pantry — it helps your {nutrient} gap.",
        "de": "Du hast {item} bereits im Vorrat — es hilft bei deiner {nutrient}-Lücke.",
    },
    "rec.no_gaps": {
        "en": "Your basket looks balanced across the tracked dimensions — no specific action needed right now.",
        "de": "Dein Warenkorb wirkt über die erfassten Dimensionen ausgewogen — aktuell ist keine bestimmte Maßnahme nötig.",
    },
    "rec.positive_history": {
        "en": "You've responded positively to this before.",
        "de": "Darauf hast du zuvor positiv reagiert.",
    },
    "rec.action_item": {
        "en": "{verb}: {item}",
        "de": "{verb}: {item}",
    },
    "rec.no_suitable": {
        "en": "We couldn't find a recommendation that fits your dietary profile right now.",
        "de": "Wir konnten aktuell keine Empfehlung finden, die zu deinem Ernährungsprofil passt.",
    },

    # next_cart_engine.py (structured recommendations)
    "cart.no_suitable": {
        "en": "No suitable recommendation — every candidate conflicts with your profile.",
        "de": "Keine passende Empfehlung — jeder Kandidat steht im Konflikt mit deinem Profil.",
    },
    "cart.no_gaps": {
        "en": "Your basket looks balanced — no notable gaps to fill.",
        "de": "Dein Warenkorb wirkt ausgewogen — keine nennenswerten Lücken zu schließen.",
    },
    "cart.primary": {
        "en": "Top pick to close your biggest gap: {item}.",
        "de": "Top-Empfehlung, um deine größte Lücke zu schließen: {item}.",
    },

    # health_score.py
    "hs.balanced": {
        "en": "Your basket looks balanced across every tracked dimension.",
        "de": "Dein Warenkorb wirkt über alle erfassten Dimensionen ausgewogen.",
    },
    "hs.low_only": {
        "en": "Your basket is low in {low}.",
        "de": "Dein Warenkorb enthält wenig {low}.",
    },
    "hs.high_only": {
        "en": "Your basket is high in {high}.",
        "de": "Dein Warenkorb enthält viel {high}.",
    },
    "hs.low_and_high": {
        "en": "Your basket is low in {low} and high in {high}.",
        "de": "Dein Warenkorb enthält wenig {low} und viel {high}.",
    },

    # explainer.py
    "expl.sentence": {
        "en": "Because {goal_phrase} and your basket is currently {gap_verb} {nutrient}, we suggest you {action} {item}.",
        "de": "Da {goal_phrase} und dein Warenkorb aktuell {gap_verb} {nutrient} ist, empfehlen wir dir {item}.",
    },
    "expl.diet_fit": {
        "en": "This fits your {diet} diet — nothing here conflicts with it.",
        "de": "Das passt zu deiner {diet}-Ernährung — nichts hier steht im Konflikt damit.",
    },
    "expl.gap_verb.low": {"en": "low in", "de": "arm an"},
    "expl.gap_verb.high": {"en": "high in", "de": "reich an"},
    "expl.goal.build_muscle": {
        "en": "you're focused on building muscle and strength",
        "de": "du dich auf Muskelaufbau und Kraft konzentrierst",
    },
    "expl.goal.lose_weight_gradually": {
        "en": "you're working towards gradual weight loss",
        "de": "du auf eine schrittweise Gewichtsabnahme hinarbeitest",
    },
    "expl.goal.maintain": {
        "en": "you want to maintain your current weight",
        "de": "du dein aktuelles Gewicht halten möchtest",
    },

    # exclusion_filter.py — conflict reasons
    "excl.diet": {
        "en": "'{name}' conflicts with a {diet} diet ({tag}).",
        "de": "'{name}' steht im Konflikt mit einer {diet}-Ernährung ({tag}).",
    },
    "excl.allergy": {
        "en": "'{name}' may contain '{allergen}', which you've marked as an allergy.",
        "de": "'{name}' könnte '{allergen}' enthalten, das du als Allergie angegeben hast.",
    },
    "excl.dislike": {
        "en": "'{name}' matches your excluded item '{item}'.",
        "de": "'{name}' entspricht deinem ausgeschlossenen Eintrag '{item}'.",
    },

    # progress_tracker.py
    "prog.disclaimer": {
        "en": "Based on estimated consumption from shopping habits only.",
        "de": "Basierend nur auf geschätztem Verzehr aus dem Einkaufsverhalten.",
    },
    "prog.improving": {
        "en": "Your nutrition profile looks better compared to your last receipt — keep it up.",
        "de": "Dein Ernährungsprofil sieht besser aus als bei deinem letzten Kassenbon — weiter so.",
    },
    "prog.stable": {
        "en": "Your shopping habits look similar to last time — small changes add up over time.",
        "de": "Dein Einkaufsverhalten ähnelt dem letzten Mal — kleine Änderungen summieren sich mit der Zeit.",
    },
    "prog.declining": {
        "en": "A few dimensions look lower than last time — your next receipt will show if it evens out.",
        "de": "Einige Dimensionen sind niedriger als beim letzten Mal — dein nächster Kassenbon zeigt, ob es sich ausgleicht.",
    },
    "prog.insufficient_data": {
        "en": "Upload another receipt next time you shop to start tracking your progress.",
        "de": "Lade beim nächsten Einkauf einen weiteren Kassenbon hoch, um deinen Fortschritt zu verfolgen.",
    },

    # nutri_coach.py — rule-based fallback fragments
    "coach.score": {
        "en": "Your health score is {value}/100 ({label}).",
        "de": "Dein Health Score liegt bei {value}/100 ({label}).",
    },
    "coach.attention": {
        "en": "Right now your basket could use some attention on: {names}.",
        "de": "Aktuell könnte dein Warenkorb etwas Aufmerksamkeit brauchen bei: {names}.",
    },
    "coach.try": {
        "en": "A good next step: {item}.",
        "de": "Ein guter nächster Schritt: {item}.",
    },
    "coach.easy_start": {
        "en": "An easy place to start: {item}.",
        "de": "Ein einfacher Anfang: {item}.",
    },
    "coach.trend": {
        "en": "Compared to last time, things look {trend}.",
        "de": "Im Vergleich zum letzten Mal sieht es {trend} aus.",
    },
    "coach.empty": {
        "en": "Keep going — upload another receipt to start seeing how your basket is trending.",
        "de": "Bleib dran — lade einen weiteren Kassenbon hoch, um den Trend deines Warenkorbs zu sehen.",
    },
    "coach.trend.improving": {"en": "better", "de": "besser"},
    "coach.trend.declining": {"en": "worse", "de": "schlechter"},
    "coach.trend.stable": {"en": "about the same", "de": "etwa gleich"},

    # source_labels.py
    "src.category": {"en": "Estimated from category: {category}", "de": "Geschätzt aus Kategorie: {category}"},
    "src.verified": {
        "en": "Verified match (learned from corrections)",
        "de": "Bestätigter Treffer (aus Korrekturen gelernt)",
    },
    "src.bls": {"en": "BLS (German food composition table)", "de": "BLS (Bundeslebensmittelschlüssel)"},
    "src.off": {"en": "OpenFoodFacts", "de": "OpenFoodFacts"},
    "src.none": {"en": "No matching nutrition data", "de": "Keine passenden Nährwertdaten"},

    # health-score labels (rendered where the numeric label is shown as text)
    "hslabel.great": {"en": "great", "de": "sehr gut"},
    "hslabel.good": {"en": "good", "de": "gut"},
    "hslabel.needs_improvement": {"en": "needs improvement", "de": "verbesserungswürdig"},
    "hslabel.poor": {"en": "poor", "de": "schwach"},
}


def t(lang, key: str, **params) -> str:
    """Localized string for `key`, with `{placeholders}` filled from params.
    Unknown key → the key itself (visible, never raises)."""
    lang = _norm(lang)
    entry = _MESSAGES.get(key)
    if entry is None:
        return key
    template = entry.get(lang) or entry.get(_DEFAULT) or key
    if params:
        try:
            return template.format(**params)
        except (KeyError, IndexError, ValueError):
            return template
    return template
