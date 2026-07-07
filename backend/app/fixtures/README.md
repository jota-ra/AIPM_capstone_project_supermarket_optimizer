# Fixtures

Test data for the receipt pipeline (Task 1.5) and the Day-1 contracts in
`sprint_plan_3weeks.md`.

- `receipts/clean_receipt.txt` — a well-formatted German receipt, for the
  text-fallback path (`POST /receipts` with `text=`).
- `receipts/messy_receipt.txt` — abbreviated/noisy text, to stress the parser.
- `parsed_items.json` — the `ParsedReceiptItem[]` contract: the item shape the
  parser produces and Epic 2's matcher consumes. Validates against
  `ParsedReceipt.items` in `models/receipt.py`.
- `profile.json` — the `Profile` contract (sprint plan Day-1 contract):
  goal, age_range, activity_level, dietary_pattern, exclusions[]. Produced by
  `POST /profile` (Epic 3) and consumed by the exclusion filter (Task 3.3)
  and, eventually, the Epic 5 recommender. Validates against
  `ProfileCreate` in `models/profile.py`.

TODO (team): add real photo samples `receipts/clean_receipt.jpg` and
`receipts/messy_receipt.jpg` for the image path — those can't be generated
here and are needed to exercise OCR end-to-end and as the demo fallback.
