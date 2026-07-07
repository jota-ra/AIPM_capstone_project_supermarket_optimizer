from fastapi import FastAPI
from backend.app.api.receipts import router as receipts_router
from backend.app.api.profile import router as profile_router

app = FastAPI(title="NutriWise API")

app.include_router(receipts_router)
app.include_router(profile_router)
@app.get("/")
def root():
    return {"message": "NutriWise API is running"}