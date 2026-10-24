from pathlib import Path
import re

class PatchValidationError(Exception):
    pass

def validate_patch(patch_text: str) -> bool:
    # Reject absolute paths
    if re.search(r'([A-Za-z]:[\\/]|^/)', patch_text):
        raise PatchValidationError("absolute paths not allowed")
    # Reject path traversal
    if '..' in patch_text:
        raise PatchValidationError("path traversal not allowed")
    if '---' not in patch_text or '+++' not in patch_text:
        raise PatchValidationError("not a unified diff")
    return True
