from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api.receipts import router as receipts_router
from backend.app.api.profile import router as profile_router
from backend.app.api.nutrition import router as nutrition_router
from backend.app.api.recommendations import router as recommendations_router

app = FastAPI(title="NutriWise API")

# Dev-only: allow the local Vite frontend (port 5173) to call this API
# from the browser. Tighten this to a real origin allowlist before deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(receipts_router)
app.include_router(profile_router)
app.include_router(nutrition_router)
app.include_router(recommendations_router)
@app.get("/")
def root():
    return {"message": "NutriWise API is running"}