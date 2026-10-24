from pathlib import Path
import re

class PatchValidationError(Exception):
    pass


def validate_patch(patch_text: str) -> bool:
    if not isinstance(patch_text, str):
        raise PatchValidationError("invalid patch")
    # Reject null bytes
    if '\x00' in patch_text:
        raise PatchValidationError("invalid patch")
    # Reject absolute paths
    if re.search(r'([A-Za-z]:[\\/]|^/)', patch_text) or re.search(
        r'(?m)^(?:---|\+\+\+) (?:[ab]/)?(?:/|[A-Za-z]:[\\/])',
        patch_text,
    ):
        raise PatchValidationError("absolute paths not allowed")
    # Reject path traversal
    if '..' in patch_text:
        raise PatchValidationError("path traversal not allowed")
    # Reject binary patch markers
    if 'GIT binary patch' in patch_text or 'Binary files' in patch_text:
        raise PatchValidationError("binary patches not allowed")
    if '---' not in patch_text or '+++' not in patch_text:
        raise PatchValidationError("not a unified diff")
    # Basic header check
    if not re.search(r'^(diff --git|--- )', patch_text, re.M):
        raise PatchValidationError("not a unified diff")
    return True
