from app.patch import validate_patch, PatchValidationError
import pytest

def test_reject_traversal():
    with pytest.raises(PatchValidationError):
        validate_patch('diff --git a/../../etc/passwd b/../../etc/passwd\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-x\n+y\n')

def test_reject_absolute():
    with pytest.raises(PatchValidationError):
        validate_patch('diff --git a/C:/Windows/x b/C:/Windows/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-x\n+y\n')

def test_reject_malformed():
    with pytest.raises(PatchValidationError):
        validate_patch('not a diff')


@pytest.mark.parametrize(
    "patch_text",
    [
        "--- a/../../etc/passwd\n+++ b/../../etc/passwd\n@@ -1 +1 @@\n-x\n+y\n",
        "--- a/C:/Windows/x\n+++ b/C:/Windows/x\n@@ -1 +1 @@\n-x\n+y\n",
        "--- /etc/passwd\n+++ /etc/passwd\n@@ -1 +1 @@\n-x\n+y\n",
    ],
)
def test_rejects_dangerous_paths(patch_text):
    with pytest.raises(PatchValidationError):
        validate_patch(patch_text)
