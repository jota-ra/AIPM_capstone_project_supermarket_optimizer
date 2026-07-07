from pathlib import Path

from backend.app.services.receipt_parser import scan_receipt_bytes

path = Path(sys.argv[1])

with open(path, "rb") as f:
    file_bytes = f.read()

result = scan_receipt_bytes(
    file_bytes=file_bytes,
    filename=path.name,
)