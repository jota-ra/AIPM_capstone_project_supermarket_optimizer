from fastapi import APIRouter, UploadFile, File
from uuid import uuid4

from backend.app.services.storage import upload_receipt_bytes
from backend.app.services.receipt_parser import scan_receipt_bytes
from backend.app.db.supabase import (
    create_receipt_row,
    update_receipt_with_parse,
)

from backend.app.db.receipt_items_repo import insert_receipt_items

router = APIRouter()


@router.post("/receipts")
async def upload_receipt(file: UploadFile = File(...)):
    receipt_id = str(uuid4())

    # Read uploaded file once
    file_bytes = await file.read()

    # Upload to Supabase Storage
    storage_path = upload_receipt_bytes(
        file_bytes=file_bytes,
        filename=file.filename,
        content_type=file.content_type,
    )

    # Create DB row
    create_receipt_row(
        receipt_id,
        file.filename,
        file.content_type,
        storage_path,
    )

    # Parse receipt with Gemini
    parsed = scan_receipt_bytes(
        file_bytes=file_bytes,
        filename=file.filename,
    )

    # Update DB with parser output
    update_receipt_with_parse(receipt_id, parsed)

     # 6. NORMALIZATION STEP (THIS WAS MISSING)
    insert_receipt_items(receipt_id, parsed)

    return {
        "receipt_id": receipt_id,
        "storage_path": storage_path,
        "parsed": parsed,
    }