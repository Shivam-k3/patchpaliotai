from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from pathlib import Path
import logging
from .workflow import Workflow
from .gemini import generate_patch, GeminiError
from .config import settings
from . import patch as patch_mod
from .projects import list_projects, resolve_project

logger = logging.getLogger("patchpilot.api")
router = APIRouter()
workflow = Workflow()

# samples/ lives at the repo root, next to backend/
SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"


def _is_safe_test_command(cmd: str) -> bool:
    if not cmd or not isinstance(cmd, str):
        return False
    c = cmd.strip()
    # Reject shell metacharacters that enable chaining/substitution
    forbidden = [";", "&", "|", "`", "$(", "$", ">", "<", "\n", "\r"]
    for f in forbidden:
        if f in c:
            return False
    # Allow only known safe commands
    allowed = getattr(settings, "allowed_test_commands", ["python -m pytest", "python -m pytest -v", "pytest", "pytest -v"])
    if c in allowed:
        return True
    # Allow only exact prefixes for pytest
    if c.startswith("python -m pytest") or c == "pytest":
        # Ensure no extra shell chars already checked
        return True
    return False


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
    allowed_extensions = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html"}
    for p in sorted(sample_dir.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in allowed_extensions:
            continue
        rel = p.relative_to(sample_dir)
        if any(part.startswith((".", "_")) or part in {"node_modules", "dist"} for part in rel.parts):
            continue
        # Block suspicious paths
        if ".." in rel.parts or rel.is_absolute():
            continue
        try:
            size = p.stat().st_size
            if size > settings.max_file_size_bytes:
                continue
            files[rel.as_posix()] = p.read_text(encoding="utf-8", errors="replace")
            if len(files) >= settings.max_files_count:
                break
        except Exception:
            continue
    return files


class VerifyRequest(BaseModel):
    sample_name: str | None = None
    project_id: str | None = None
    patch_text: str | None = None
    test_command: str = "python -m pytest -v"


class AnalyzeRequest(BaseModel):
    bug_report: str = Field(..., min_length=1, max_length=10000)
    files: dict | None = None
    sample_name: str | None = None
    project_id: str | None = None


@router.get("/samples")
def samples():
    return {"samples": list_samples()}


@router.get("/projects")
def projects():
    return {
        "projects": [
            {
                "id": project.project_id,
                "label": project.label,
                "runtime": project.runtime,
                "test_command": " ".join(project.test_command),
                "build_command": " ".join(project.build_command),
            }
            for project in list_projects()
            if _project_available(project.project_id)
        ]
    }


def _project_available(project_id: str) -> bool:
    try:
        resolve_project(project_id)
        return True
    except ValueError:
        return False


@router.post("/verify")
def verify(req: VerifyRequest):
    if bool(req.sample_name) == bool(req.project_id):
        raise HTTPException(status_code=400, detail="exactly one project or sample is required")
    project = None
    if req.project_id:
        try:
            project = resolve_project(req.project_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="project not found")
    else:
        if not req.sample_name:
            raise HTTPException(status_code=400, detail="sample required")
        sample_dir = resolve_sample(req.sample_name)
    if not req.patch_text:
        raise HTTPException(status_code=400, detail="patch required")
    if len(req.patch_text) > settings.max_patch_size_bytes:
        raise HTTPException(status_code=400, detail="patch too large")
    if project is not None:
        if req.test_command != "python -m pytest -v":
            raise HTTPException(status_code=400, detail="project commands are fixed")
    elif not _is_safe_test_command(req.test_command):
        raise HTTPException(status_code=400, detail="unsupported test command")
    try:
        patch_mod.validate_patch(req.patch_text)
    except Exception as e:
        logger.debug("Patch validation failed")
        raise HTTPException(status_code=400, detail="invalid patch")
    try:
        result = workflow.verify_project(project, req.patch_text) if project else workflow.verify(sample_dir, req.patch_text, req.test_command)
        return result
    except Exception as e:
        logger.exception("Verify failed")
        raise HTTPException(status_code=500, detail="Verification failed")


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    if not req.bug_report.strip():
        raise HTTPException(status_code=400, detail="bug report required")
    if len(req.bug_report) > settings.max_bug_report_chars:
        raise HTTPException(status_code=400, detail="bug report too large")
    if req.files is not None and len(req.files) > settings.max_files_count:
        raise HTTPException(status_code=400, detail="too many files")
    if req.sample_name and req.project_id:
        raise HTTPException(status_code=400, detail="exactly one project or sample is supported")
    sample_dir = resolve_sample(req.sample_name) if req.sample_name else None
    if req.project_id:
        try:
            project = resolve_project(req.project_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="project not found")
        sample_dir = project.root
    try:
        files = sample_files(sample_dir) if sample_dir else {}
        if req.files:
            files.update(req.files or {})
        result = generate_patch(req.bug_report, files)
        return result
    except GeminiError as e:
        logger.warning("Gemini error")
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Analyze failed")
        raise HTTPException(status_code=500, detail="Analysis failed")
