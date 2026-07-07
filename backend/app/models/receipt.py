from typing import Optional, List

from pydantic import BaseModel, Field


class ReceiptItem(BaseModel):
    """
    A single grocery line item as extracted by the parser.

    Mirrors the item shape produced by RECEIPT_SCHEMA in
    services/receipt_parser.py, so parser output validates directly
    against this model regardless of whether it came from an image or
    from pasted text.
    """

    name: str
    original_text: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    category: str
    uncertain: bool


class ParsedReceipt(BaseModel):
    """
    Structured output of the receipt parser (Story 1.4).

    This is the contract every downstream stage (matching, nutrition,
    gaps) can rely on. Extra keys from the model are ignored, so the
    parser can add fields without breaking validation.
    """

    store: str
    scan_quality: str
    items: List[ReceiptItem]
    non_food_items_ignored: List[str] = Field(default_factory=list)
    items_count: int
    error: Optional[str] = None


class ReceiptItemUpdate(BaseModel):
    """
    Fields a user may correct on a parsed item during review (Story 1.3).

    All optional: only the provided fields are updated. Mapped to the
    receipt_items table columns, not the raw parser item shape.
    """

    normalized_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
