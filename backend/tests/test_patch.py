from app.patch import validate_patch, PatchValidationError
import pytest

def test_validate_rejects_traversal():
    with pytest.raises(PatchValidationError):
        validate_patch("--- a/../../../etc/passwd\n+++ b/../../../etc/passwd\n@@ -1 +1 @@\n-x\n+y\n")

def test_validate_rejects_absolute():
    with pytest.raises(PatchValidationError):
        validate_patch("--- a/C:\\Windows\\x\n+++ b/C:\\Windows\\x\n@@ -1 +1 @@\n-x\n+y\n")

def test_validate_accepts_simple():
    assert validate_patch("--- a/mathlib.py\n+++ b/mathlib.py\n@@ -1 +1 @@\n-x\n+y\n") is True
