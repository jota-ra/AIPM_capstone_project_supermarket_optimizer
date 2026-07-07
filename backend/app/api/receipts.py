from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from uuid import uuid4

from pydantic import ValidationError

from backend.app.services.storage import upload_receipt_bytes
from backend.app.services.receipt_parser import (
    scan_receipt_bytes,
    scan_receipt_text,
)
from backend.app.db.supabase import (
    create_receipt_row,
    update_receipt_with_parse,
    get_receipt,
    get_receipt_items,
    update_receipt_item,
)
from backend.app.db.receipt_items_repo import insert_receipt_items
from backend.app.models.receipt import ParsedReceipt, ReceiptItemUpdate
from backend.app.services.nutrition_mapping import map_items

router = APIRouter()


@router.post("/receipts")
async def upload_receipt(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
):
    """
    Create a receipt from either an uploaded image OR pasted text.

    Story 1.1 (image upload) and Story 1.2 (text fallback) share this
    endpoint: exactly one of `file` / `text` must be supplied. Both paths
    end up as the same structured, schema-validated receipt.
    """

    if file is None and not (text and text.strip()):
        raise HTTPException(
            status_code=400,
            detail="Provide either a receipt image ('file') or receipt text ('text').",
        )

    receipt_id = str(uuid4())

    if file is not None:
        # Image path (Story 1.1)
        file_bytes = await file.read()
        storage_path = upload_receipt_bytes(
            file_bytes=file_bytes,
            filename=file.filename,
            content_type=file.content_type,
        )
        create_receipt_row(receipt_id, file.filename, file.content_type, storage_path)
        parsed = scan_receipt_bytes(file_bytes=file_bytes, filename=file.filename)
        input_type = "image"
    else:
        # Text fallback path (Story 1.2) — nothing to store in object storage
        storage_path = None
        create_receipt_row(receipt_id, None, "text/plain", None)
        parsed = scan_receipt_text(raw_text=text)
        input_type = "text"

    # Parser reported a hard failure -> record it, surface it, don't crash downstream
    if isinstance(parsed, dict) and parsed.get("error"):
        update_receipt_with_parse(receipt_id, parsed)
        raise HTTPException(
            status_code=502,
            detail=f"Receipt parsing failed: {parsed['error']}",
        )

    # Story 1.4: validate parser output against the structured schema
    try:
        validated = ParsedReceipt.model_validate(parsed)
    except ValidationError as e:
        update_receipt_with_parse(receipt_id, parsed)
        raise HTTPException(
            status_code=502,
            detail=f"Parser output failed schema validation: {e.errors()}",
        )

    update_receipt_with_parse(receipt_id, parsed)
    insert_receipt_items(receipt_id, parsed)

    return {
        "receipt_id": receipt_id,
        "input_type": input_type,
        "storage_path": storage_path,
        "parsed": validated.model_dump(),
    }


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


@router.get("/receipts/{receipt_id}/mapping")
def map_receipt_nutrition(receipt_id: str):
    """
    Map a receipt's items to nutrition data (Epic 2).

    For each stored receipt item: try an OpenFoodFacts match (Story 2.1),
    fall back to a category-based estimate when no confident match exists
    (Story 2.2), and return aggregate match quality (Story 2.3).

    Read-through enrichment: it does not mutate the receipt, it returns
    the `MatchedProduct[]` + `MatchQuality` artifact for downstream use.
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
    return {"receipt_id": receipt_id, **result.model_dump()}
