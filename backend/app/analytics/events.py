"""
Analytics event logger (Task 9.1).

Logs the key pipeline events the roadmap calls out (upload_started,
upload_completed, parsing_success, match_rate, recommendation_viewed,
feedback_submitted) so drop-off and pipeline health can be reviewed
after a test session.

Fire-and-forget by design: analytics must never be the reason a request
fails. If the `events` table doesn't exist yet (e.g. before its
migration has been run) or the insert otherwise errors, this logs to
stdout instead rather than raising.
"""

from typing import Optional
from uuid import uuid4

from backend.app.db.supabase import supabase


def log_event(name: str, payload: Optional[dict] = None, user_id: Optional[str] = None) -> None:
    record = {
        "id": str(uuid4()),
        "name": name,
        "payload": payload or {},
        "user_id": user_id,
    }
    try:
        supabase.table("events").insert(record).execute()
    except Exception as e:  # noqa: BLE001 - analytics must never break the request
        print(f"[analytics] failed to log event {name!r}: {e}")
