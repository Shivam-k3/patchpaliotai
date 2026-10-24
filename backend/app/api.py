from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
from .workflow import Workflow
from .gemini import generate_patch, GeminiError

router = APIRouter()
workflow = Workflow()

# samples/ lives at the repo root, next to backend/
SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"

def list_samples() -> list[str]:
    if not SAMPLES_DIR.is_dir():
        return []
    return sorted(p.name for p in SAMPLES_DIR.iterdir() if p.is_dir() and not p.name.startswith((".", "_")))

def resolve_sample(name: str) -> Path:
    if name not in list_samples():
        raise HTTPException(status_code=400, detail="sample not found")
    return SAMPLES_DIR / name

def sample_files(sample_dir: Path) -> dict[str, str]:
    files = {}
    for p in sorted(sample_dir.rglob("*.py")):
        rel = p.relative_to(sample_dir)
        if any(part.startswith((".", "_")) for part in rel.parts):
            continue
        files[rel.as_posix()] = p.read_text(encoding="utf-8", errors="replace")
    return files

class VerifyRequest(BaseModel):
    sample_name: str | None = None
    patch_text: str | None = None
    test_command: str = "python -m pytest -v"

class AnalyzeRequest(BaseModel):
    bug_report: str
    files: dict | None = None
    sample_name: str | None = None

@router.get("/samples")
def samples():
    return {"samples": list_samples()}

@router.post("/verify")
def verify(req: VerifyRequest):
    if not req.sample_name:
        raise HTTPException(status_code=400, detail="sample required")
    sample_dir = resolve_sample(req.sample_name)
    if not req.patch_text:
        raise HTTPException(status_code=400, detail="patch required")
    try:
        result = workflow.verify(sample_dir, req.patch_text, req.test_command)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    if not req.bug_report.strip():
        raise HTTPException(status_code=400, detail="bug report required")
    sample_dir = resolve_sample(req.sample_name) if req.sample_name else None
    try:
        files = sample_files(sample_dir) if sample_dir else {}
        files.update(req.files or {})
        result = generate_patch(req.bug_report, files)
        return result
    except GeminiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
