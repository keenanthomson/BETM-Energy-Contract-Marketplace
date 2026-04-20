import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import contracts, meta, portfolio

app = FastAPI(title="Energy Contract Marketplace")

allow_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contracts.router)
app.include_router(portfolio.router)
app.include_router(meta.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
