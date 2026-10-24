import os
from typing import Dict, Any

class GeminiError(Exception):
    pass

def generate_patch(bug_report: str, files: Dict[str, str], api_key: str | None = None, model: str = None) -> Dict[str, Any]:
    try:
        from google import genai
    except Exception as e:
        raise GeminiError(f"google-genai not available: {e}")
    
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise GeminiError("GEMINI_API_KEY not configured")
    
    model = model or os.environ.get("MODEL_NAME") or "gemini-flash-latest"
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
            model=model,
            contents=prompt,
        )
        text = resp.text or ""
        import json
        try:
            return json.loads(text)
        except Exception:
            start = text.find('{')
            end = text.rfind('}') + 1
            if start >= 0 and end > start:
                return json.loads(text[start:end])
            raise GeminiError("invalid model output")
    except GeminiError:
        raise
    except Exception as e:
        raise GeminiError(str(e))
