import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.receipts import router as receipts_router
from backend.app.api.profile import router as profile_router
from backend.app.api.nutrition import router as nutrition_router
from backend.app.api.recommendations import router as recommendations_router
from backend.app.api.feedback import router as feedback_router
from backend.app.api.analytics import router as analytics_router
from backend.app.api.pantry import router as pantry_router
from backend.app.api.products import router as products_router
from backend.app.api.consumption import router as consumption_router

app = FastAPI(title="NutriWise API")

# Local Vite dev server. Vite falls back to 5174+ when 5173 is already
# taken, so a small range is allowlisted rather than just the default port.
_DEV_ORIGINS = [
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in range(5173, 5178)
]

# Production origin(s) — set ALLOWED_ORIGINS on the host (e.g. Render) to
# a comma-separated list, e.g. "https://nutriwise.vercel.app". Not
# hardcoded here since the real Vercel URL isn't known until deployed,
# and differs between preview and production deploys.
_PROD_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEV_ORIGINS + _PROD_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(receipts_router)
app.include_router(profile_router)
app.include_router(nutrition_router)
app.include_router(recommendations_router)
app.include_router(feedback_router)
app.include_router(analytics_router)
app.include_router(pantry_router)
app.include_router(products_router)
app.include_router(consumption_router)
@app.get("/")
def root():
    return {"message": "NutriWise API is running"}