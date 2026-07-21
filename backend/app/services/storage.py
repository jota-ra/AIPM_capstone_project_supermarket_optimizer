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


def delete_receipt_bytes(storage_path: str):
    """Remove an uploaded receipt image (GDPR: user-initiated erasure)."""

    supabase.storage.from_("receipts").remove([storage_path])


def get_receipt_image_url(storage_path: str, expires_in: int = 600) -> str:
    """
    A short-lived signed URL for a stored receipt image — Review shows the
    photo the user just uploaded at the top of the page (E12-S5/BR-P4:
    the image is only ever kept between upload and the end of review, see
    delete_receipt_bytes / the DELETE .../image route, so 10 minutes is
    already generous relative to how long that window actually stays open).
    """

    result = supabase.storage.from_("receipts").create_signed_url(storage_path, expires_in)
    return result["signedURL"]