"""
Centralized pipeline error handling (Task 9.3).

Every stage of the pipeline can fail without killing the whole request
or leaving the frontend with nothing to show. This gives every failure
a named `stage` (for the analytics event, Task 9.1) while keeping the
HTTP response's `detail` a plain string, since the frontend's ApiError
already renders `detail` directly as the user-facing message — changing
that shape would be a breaking change for no benefit here.
"""

from typing import Optional

from fastapi import HTTPException

from backend.app.analytics.events import log_event


class PipelineStage:
    PARSING = "parsing"
    SCHEMA_VALIDATION = "schema_validation"
    MATCHING = "matching"
    SNAPSHOT = "snapshot"
    RECOMMENDATION = "recommendation"


def pipeline_error(
    status_code: int,
    stage: str,
    message: str,
    user_id: Optional[str] = None,
) -> HTTPException:
    """
    Build the HTTPException to raise for a pipeline failure, and record
    it as a `pipeline_error` analytics event tagged with its stage so
    recurring failure points are visible without reading server logs.
    """

    log_event("pipeline_error", {"stage": stage, "message": message}, user_id)
    return HTTPException(status_code=status_code, detail=message)
