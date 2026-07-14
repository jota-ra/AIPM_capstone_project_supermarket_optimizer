from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from uuid import uuid4

from pydantic import ValidationError
from postgrest.exceptions import APIError

from backend.app.services.storage import upload_receipt_bytes, delete_receipt_bytes
from backend.app.services.receipt_parser import (
    scan_receipt_bytes,
    scan_receipt_text,
    ERROR_RATE_LIMITED,
    ERROR_UNAVAILABLE,
    ERROR_INVALID,
)
from backend.app.services.auth import get_current_user
from backend.app.services.error_handler import pipeline_error, PipelineStage
from backend.app.analytics.events import log_event
from backend.app.db.supabase import (
    create_receipt_row,
    update_receipt_with_parse,
    get_receipt,
    get_receipt_items,
    update_receipt_item,
    delete_receipt,
    get_receipts_by_user,
    UNDEFINED_COLUMN_CODE,
)
from backend.app.db.receipt_items_repo import insert_receipt_items
from backend.app.services.pantry import add_items_to_pantry
from backend.app.models.receipt import ParsedReceipt, ReceiptItemUpdate
from backend.app.services.nutrition_mapping import map_items
from backend.app.services.nutrition_snapshot import invalidate_snapshot_cache
from backend.app.services.confidence import confidence_for_product
from backend.app.services.source_labels import source_label
from backend.app.nutrition_model import DISCLAIMER

router = APIRouter()

# E3-S5: map the parser's typed error codes to HTTP statuses. Anything
# unrecognized falls back to 502 (a generic upstream-pipeline failure).
_PARSE_ERROR_STATUS = {
    ERROR_RATE_LIMITED: 429,   # retry later
    ERROR_UNAVAILABLE: 503,    # service temporarily down
    ERROR_INVALID: 422,        # not a parseable receipt / bad input
}


@router.post("/receipts")
async def upload_receipt(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    user_id: str = Depends(get_current_user),
):
    """
    Create a receipt from either an uploaded image OR pasted text.

    Story 1.1 (image upload) and Story 1.2 (text fallback) share this
    endpoint: exactly one of `file` / `text` must be supplied. Both paths
    end up as the same structured, schema-validated receipt.

    Tagged with the authenticated `user_id` (E1) so it's grouped with the
    rest of this user's receipts (Task 8.4) instead of every receipt in
    the database being treated as one shared basket.
    """

    if file is None and not (text and text.strip()):
        raise HTTPException(
            status_code=400,
            detail="Provide either a receipt image ('file') or receipt text ('text').",
        )

    log_event("upload_started", {"input_type": "image" if file is not None else "text"}, user_id)
    receipt_id = str(uuid4())

    if file is not None:
        # Image path (Story 1.1 / E3-S1)
        file_bytes = await file.read()
        # E3-S5: storing the original image is best-effort — a storage
        # outage must not lose a receipt we can still parse. On failure we
        # log it, drop the stored copy, and continue with storage_path=None.
        try:
            storage_path = upload_receipt_bytes(
                file_bytes=file_bytes,
                filename=file.filename,
                content_type=file.content_type,
            )
        except Exception as exc:  # storage/network — non-fatal
            storage_path = None
            log_event("storage_upload_failed", {"error": str(exc)}, user_id)
        create_receipt_row(receipt_id, file.filename, file.content_type, storage_path, user_id)
        parsed = scan_receipt_bytes(file_bytes=file_bytes, filename=file.filename)
        input_type = "image"
    else:
        # Text fallback path (Story 1.2) — nothing to store in object storage
        storage_path = None
        create_receipt_row(receipt_id, None, "text/plain", None, user_id)
        parsed = scan_receipt_text(raw_text=text)
        input_type = "text"

    # Parser reported a hard failure -> record it, surface it with the right
    # HTTP status (E3-S5), don't crash downstream.
    if isinstance(parsed, dict) and parsed.get("error"):
        update_receipt_with_parse(receipt_id, parsed)
        raise pipeline_error(
            _PARSE_ERROR_STATUS.get(parsed.get("error_code"), 502),
            PipelineStage.PARSING,
            f"Receipt parsing failed: {parsed['error']}",
            user_id,
        )

    # Story 1.4: validate parser output against the structured schema
    try:
        validated = ParsedReceipt.model_validate(parsed)
    except ValidationError as e:
        update_receipt_with_parse(receipt_id, parsed)
        raise pipeline_error(
            502,
            PipelineStage.SCHEMA_VALIDATION,
            f"Parser output failed schema validation: {e.errors()}",
            user_id,
        )

    # E3-S5: a scan that yields no food line items is an "invalid image"
    # (nothing to analyze) — surfaced as 422, not a false success.
    if not validated.items:
        raise pipeline_error(
            422,
            PipelineStage.PARSING,
            "No parseable grocery items were found on this receipt.",
            user_id,
        )

    log_event(
        "parsing_success",
        {"items_count": validated.items_count, "scan_quality": validated.scan_quality},
        user_id,
    )

    update_receipt_with_parse(receipt_id, parsed)
    insert_receipt_items(receipt_id, parsed)
    add_items_to_pantry(user_id, parsed.get("items", []))
    invalidate_snapshot_cache(user_id)
    log_event("upload_completed", {"receipt_id": receipt_id, "items_count": validated.items_count}, user_id)

    return {
        "receipt_id": receipt_id,
        "user_id": user_id,
        "input_type": input_type,
        "storage_path": storage_path,
        "parsed": validated.model_dump(),
    }


@router.get("/receipts")
def list_receipts(user_id: str = Depends(get_current_user)):
    """
    List every receipt uploaded in this session (Task 8.4 — Receipt
    History Storage), newest first. A brand-new session (no X-Session-Id
    header sent yet) always returns an empty list, since nothing has
    been tagged with its freshly-minted ID yet.

    Bug fix: this used to call get_receipts_by_user directly with no
    fallback, so it hard-500'd in any environment where the Epic 8
    migration hasn't run — unlike /nutrition/snapshot and /next-cart,
    which degrade gracefully in the same scenario via
    get_receipt_items_by_user. An empty list here (rather than
    falling back to every receipt, like those two do) is the honest
    answer for "this session's history" — there's no history to show
    that isn't a lie until the environment is migrated.
    """

    try:
        receipts = get_receipts_by_user(user_id)
    except APIError as e:
        if e.code != UNDEFINED_COLUMN_CODE:
            raise
        print("[api] 'receipts.user_id' column missing (migration pending?) — returning empty history")
        receipts = []

    return {"user_id": user_id, "receipts": receipts}


@router.get("/receipts/{receipt_id}")
def read_receipt(receipt_id: str):
    """
    Fetch a receipt and its parsed items for review (Story 1.3).

    The user can inspect what was detected before anything downstream
    happens; unmatched/uncertain items are returned as-is, not hidden.
    """

    receipt = get_receipt(receipt_id)
    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found.")

    items = get_receipt_items(receipt_id)
    return {"receipt": receipt, "items": items}


@router.patch("/receipts/{receipt_id}/items/{item_id}")
def correct_receipt_item(
    receipt_id: str,
    item_id: str,
    update: ReceiptItemUpdate,
):
    """
    Correct a single parsed item during review (Story 1.3).

    Only the fields provided in the body are changed. The item must
    belong to the given receipt.
    """

    fields = update.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    items = get_receipt_items(receipt_id)
    if not any(item.get("id") == item_id for item in items):
        raise HTTPException(
            status_code=404,
            detail="Item not found for this receipt.",
        )

    update_receipt_item(item_id, fields)
    return {"receipt_id": receipt_id, "item_id": item_id, "updated": fields}


@router.delete("/receipts/{receipt_id}")
def erase_receipt(receipt_id: str, user_id: str = Depends(get_current_user)):
    """
    Permanently delete a receipt, its items, and its uploaded image, if
    any (GDPR user-initiated erasure, Story 7.3). There's no soft-delete
    or retention window here — this is a hard delete, on request, since
    the MVP has no broader auth system to attach an automatic TTL to.

    Restricted to the session that created the receipt (bug fix: this
    used to delete by receipt_id alone, so anyone who obtained an ID —
    it's echoed back in plaintext on every upload — could erase another
    session's data). A row with no user_id on record (an environment
    that hasn't run the Epic 8 migration yet) is treated as unowned and
    still deletable, matching this codebase's other migration-window
    safety nets.
    """

    receipt = get_receipt(receipt_id)
    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found.")

    owner_session_id = receipt.get("user_id")
    if owner_session_id is not None and owner_session_id != user_id:
        raise HTTPException(status_code=403, detail="This receipt belongs to a different session.")

    storage_path = receipt.get("storage_path")
    if storage_path:
        delete_receipt_bytes(storage_path)

    delete_receipt(receipt_id)
    return {"receipt_id": receipt_id, "deleted": True}


@router.get("/receipts/{receipt_id}/mapping")
def map_receipt_nutrition(receipt_id: str, user_id: str = Depends(get_current_user)):
    """
    Map a receipt's items to nutrition data (Epic 2).

    For each stored receipt item: try an OpenFoodFacts match (Story 2.1),
    fall back to a category-based estimate when no confident match exists
    (Story 2.2), and return aggregate match quality (Story 2.3).

    Read-through enrichment: it does not mutate the receipt, it returns
    the `MatchedProduct[]` + `MatchQuality` artifact for downstream use.

    Each product also carries a plain `confidence_level` and
    `source_label` (Epic 6, Stories 6.2/6.3) so the reliability and
    provenance of every nutrition value is visible, not just the raw
    internal match score.
    """

    receipt = get_receipt(receipt_id)
    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found.")

    items = get_receipt_items(receipt_id)
    if not items:
        raise HTTPException(
            status_code=409,
            detail="Receipt has no parsed items to map.",
        )

    result = map_items(items)
    log_event("match_rate", result.match_quality.model_dump(), user_id)
    enriched_products = [
        {
            **product.model_dump(),
            "confidence_level": confidence_for_product(product).value,
            "source_label": source_label(product),
        }
        for product in result.matched_products
    ]

    return {
        "receipt_id": receipt_id,
        "user_id": user_id,
        "matched_products": enriched_products,
        "match_quality": result.match_quality.model_dump(),
        "nutrition_totals": result.nutrition_totals,  # E4-S6
        "disclaimer": DISCLAIMER,
    }
