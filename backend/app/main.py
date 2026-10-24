from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from . import api
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .logging_config import setup_logging
from . import executor

setup_logging(settings.log_level)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api.router, prefix="/api")


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Log exception details internally; return safe message
    import logging
    logger = logging.getLogger("patchpilot")
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "code": "INTERNAL_ERROR"},
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}


@app.get("/ready")
def ready():
    docker_ok = False
    try:
        docker_ok = executor._docker_available()
    except Exception:
        docker_ok = False
    samples_ok = False
    try:
        from pathlib import Path
        samples_ok = (Path(__file__).resolve().parents[2] / "samples").is_dir()
    except Exception:
        samples_ok = False
    return {
        "ready": bool(docker_ok and samples_ok),
        "checks": {
            "docker": docker_ok,
            "samples_dir": samples_ok,
        },
    }
