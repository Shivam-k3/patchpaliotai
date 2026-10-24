import os
import json
import logging
import time
from typing import Dict, Any
from .config import settings
from . import patch as patch_mod

class GeminiError(Exception):
    pass


logger = logging.getLogger("patchpilot.gemini")
MAX_TRANSIENT_RETRIES = 2
RETRY_BACKOFF_SECONDS = 0.25


REQUIRED_KEYS = {"bug_summary", "likely_root_cause", "evidence", "proposed_unified_diff", "suggested_tests", "limitations"}


def _validate_schema(data: Dict[str, Any]) -> None:
    if not isinstance(data, dict):
        raise GeminiError("invalid model output")
    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        raise GeminiError(f"invalid model output: missing fields {', '.join(sorted(missing))}")
    if not isinstance(data.get("proposed_unified_diff"), str) or not data["proposed_unified_diff"].strip():
        raise GeminiError("invalid model output: proposed_unified_diff is empty")
    # Validate the diff before returning
    try:
        patch_mod.validate_patch(data["proposed_unified_diff"])
    except Exception as exc:
        raise GeminiError(f"invalid model output: proposed patch is not a valid unified diff ({exc})")


def _parse_model_json(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].lstrip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    decoder = json.JSONDecoder()
    for index, character in enumerate(cleaned):
        if character != "{":
            continue
        try:
            data, _ = decoder.raw_decode(cleaned[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    raise GeminiError("invalid model output: expected a JSON object")


def _is_transient_provider_error(error: Exception) -> bool:
    status = getattr(error, "status_code", None) or getattr(error, "code", None)
    if status == 503:
        return True
    status_text = str(getattr(error, "status", "")).upper()
    message = str(error).upper()
    return "UNAVAILABLE" in status_text or "UNAVAILABLE" in message or "503" in message


def _provider_error_message(error: Exception) -> str:
    status = getattr(error, "status_code", None) or getattr(error, "code", None)
    message = str(error).upper()
    if status == 503 or "503" in message or "UNAVAILABLE" in message:
        return "Gemini is temporarily unavailable. Wait a moment and retry, or select another configured Gemini model."
    if status == 429 or "429" in message or "RESOURCE_EXHAUSTED" in message:
        return "Gemini quota or rate limit exceeded. Check the configured API key/project quota and try again."
    if status in {401, 403} or "UNAUTHENTICATED" in message or "PERMISSION_DENIED" in message:
        return "Gemini authentication or permission failed. Check the backend API key and project access."
    return "AI provider error"


def generate_patch(bug_report: str, files: Dict[str, str], api_key: str | None = None, model: str = None) -> Dict[str, Any]:
    try:
        from google import genai
    except Exception as e:
        raise GeminiError("google-genai not available")
    
    key = api_key or settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise GeminiError("GEMINI_API_KEY not configured")
    
    model_name = model or os.environ.get("GEMINI_MODEL") or settings.gemini_model or "gemini-3.8-flash"
    client = genai.Client(api_key=key)
    prompt = f"""You are PatchPilot. Given a bug report and files, return only one valid JSON object.
Do not use Markdown fences or prose before or after the JSON.
The proposed_unified_diff must be a complete unified diff with --- and +++ relative paths and valid @@ hunks.
Do not invent files or line content; use the supplied files exactly.

The JSON object must contain:
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
    for attempt in range(MAX_TRANSIENT_RETRIES + 1):
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            break
        except Exception as error:
            if not _is_transient_provider_error(error) or attempt == MAX_TRANSIENT_RETRIES:
                logger.error(
                    "Gemini provider request failed: model=%s status=%s error_type=%s attempt=%d",
                    model_name,
                    getattr(error, "status_code", None) or getattr(error, "code", None) or "unknown",
                    type(error).__name__,
                    attempt + 1,
                )
                raise GeminiError(_provider_error_message(error))
            delay = RETRY_BACKOFF_SECONDS * (2**attempt)
            logger.warning(
                "Gemini provider unavailable: model=%s status=503 attempt=%d/%d retry_in=%.2fs",
                model_name,
                attempt + 1,
                MAX_TRANSIENT_RETRIES + 1,
                delay,
            )
            time.sleep(delay)
    try:
        text = resp.text or ""
        data = _parse_model_json(text)
        _validate_schema(data)
        return data
    except GeminiError:
        raise
    except Exception as e:
        raise GeminiError("AI provider error")
