from supabase import create_client
from backend.app.core.config import settings

supabase = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_KEY
)

def create_receipt_row(receipt_id, file_name, file_type, storage_path):
    return supabase.table("receipts").insert({
        "id": receipt_id,
        "file_name": file_name,
        "file_type": file_type,
        "storage_path": storage_path,
        "status": "uploaded",
    }).execute()


def update_receipt_with_parse(receipt_id, parsed_data: dict):
    return supabase.table("receipts").update({
        "raw_text": parsed_data,
        "status": "processed",
    }).eq("id", receipt_id).execute()