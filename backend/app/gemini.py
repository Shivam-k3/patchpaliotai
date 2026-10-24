import os
import json
from typing import Dict, Any
from .config import settings
from . import patch as patch_mod

class GeminiError(Exception):
    pass


REQUIRED_KEYS = {"bug_summary", "likely_root_cause", "evidence", "proposed_unified_diff", "suggested_tests", "limitations"}


def _validate_schema(data: Dict[str, Any]) -> None:
    if not isinstance(data, dict):
        raise GeminiError("invalid model output")
    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        raise GeminiError("invalid model output")
    if not isinstance(data.get("proposed_unified_diff"), str) or not data["proposed_unified_diff"].strip():
        raise GeminiError("invalid model output")
    # Validate the diff before returning
    try:
        patch_mod.validate_patch(data["proposed_unified_diff"])
    except Exception:
        raise GeminiError("invalid model output")


def generate_patch(bug_report: str, files: Dict[str, str], api_key: str | None = None, model: str = None) -> Dict[str, Any]:
    try:
        from google import genai
    except Exception as e:
        raise GeminiError("google-genai not available")
    
    key = api_key or settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise GeminiError("GEMINI_API_KEY not configured")
    
    model_name = model or settings.model_name or os.environ.get("MODEL_NAME") or "gemini-flash-latest"
    client = genai.Client(api_key=key)
    prompt = f"""You are PatchPilot. Given a bug report and files, return a JSON object with:
- bug_summary
- likely_root_cause
- evidence
- proposed_unified_diff (valid unified diff, relative paths only)
- suggested_tests
- limitations

Bug report:
{bug_report}

Files:
{files}
"""
    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        text = resp.text or ""
        try:
            data = json.loads(text)
        except Exception:
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                try:
                    data = json.loads(text[start:end])
                except Exception:
                    raise GeminiError("invalid model output")
            else:
                raise GeminiError("invalid model output")
        _validate_schema(data)
        return data
    except GeminiError:
        raise
    except Exception as e:
        raise GeminiError("AI provider error")

