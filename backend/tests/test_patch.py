from pathlib import Path
from tempfile import TemporaryDirectory

from app.executor import apply_patch
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


PATCH = """--- a/mathlib.py
+++ b/mathlib.py
@@ -1,2 +1,2 @@
 def divide(a, b):
-    return a / b
+    return a // b
"""


@pytest.mark.parametrize("patch_line_ending", ["\n", "\r\n"])
@pytest.mark.parametrize("file_line_ending", ["\n", "\r\n"])
def test_apply_patch_supports_line_endings(patch_line_ending, file_line_ending):
    with TemporaryDirectory() as temp_dir:
        workdir = Path(temp_dir)
        source = "def divide(a, b):\n    return a / b\n".replace("\n", file_line_ending)
        (workdir / "mathlib.py").write_text(source, encoding="utf-8", newline="")
        patch_text = PATCH.replace("\n", patch_line_ending)

        apply_patch(patch_text, workdir)

        assert (workdir / "mathlib.py").read_text(encoding="utf-8") == "def divide(a, b):\n    return a // b\n"


def test_apply_patch_normalized_file_uses_git_content():
    with TemporaryDirectory() as temp_dir:
        workdir = Path(temp_dir)
        (workdir / "mathlib.py").write_text(
            "\ufeffdef divide(a, b):\n    return a / b\n",
            encoding="utf-8",
            newline="\n",
        )

        apply_patch(PATCH, workdir)

        assert "return a // b" in (workdir / "mathlib.py").read_text(encoding="utf-8")
