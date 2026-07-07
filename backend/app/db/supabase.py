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


def get_receipt(receipt_id):
    result = (
        supabase.table("receipts")
        .select("*")
        .eq("id", receipt_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_receipt_items(receipt_id):
    result = (
        supabase.table("receipt_items")
        .select("*")
        .eq("receipt_id", receipt_id)
        .execute()
    )
    return result.data


def update_receipt_item(item_id, fields: dict):
    return (
        supabase.table("receipt_items")
        .update(fields)
        .eq("id", item_id)
        .execute()
    )


def create_profile_row(profile_id: str, fields: dict):
    return supabase.table("profiles").insert({
        "id": profile_id,
        **fields,
    }).execute()


def get_profile(profile_id: str):
    result = (
        supabase.table("profiles")
        .select("*")
        .eq("id", profile_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None