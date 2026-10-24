from fastapi import FastAPI
from . import api
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PatchPilot AI")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api.router, prefix="/api")

@app.get("/health")
def health():
    return {"status": "ok"}
