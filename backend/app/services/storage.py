from uuid import uuid4
from backend.app.db.supabase import supabase


def upload_receipt_bytes(file_bytes, filename, content_type):
    storage_path = f"{uuid4()}_{filename}"

    supabase.storage.from_("receipts").upload(
        path=storage_path,
        file=file_bytes,
        file_options={
            "content-type": content_type,
            "upsert": False,
        },
    )

    return storage_path