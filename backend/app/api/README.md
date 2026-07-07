POST /api/v1/receipts - Upload
GET /api/v1/receipts/{receipt_id} - Retrieve parsed receipt
POST /profile - Create a lightweight user profile (Story 3.1)
GET /profile/{profile_id} - Retrieve a stored profile

# Tables
## users

id UUID
email
created_at

## receipts

id UUID
user_id UUID
upload_time TIMESTAMP
file_name
file_type
storage_path
raw_text
status
created_at

## receipt_items

id UUID
receipt_id UUID
raw_name
normalized_name
quantity
price
matched_product_id
confidence

## products

id UUID
off_id
name
brand
nutrition_json

## profiles

id UUID
goal
age_range
activity_level
dietary_pattern
exclusions (text[] / jsonb)
created_at