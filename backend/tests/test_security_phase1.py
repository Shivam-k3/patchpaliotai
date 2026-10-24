import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app import patch as patch_mod
from app.patch import PatchValidationError
from app.gemini import generate_patch, GeminiError
from app import executor
import tempfile
import os

client = TestClient(app)


def test_verify_rejects_shell_metachars():
    resp = client.post("/api/verify", json={"sample_name": "case1_fix_no_regression", "patch_text": "--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-a\n+b\n", "test_command": "python -m pytest; rm -rf /"})
    assert resp.status_code == 400


def test_verify_rejects_command_chaining():
    resp = client.post("/api/verify", json={"sample_name": "case1_fix_no_regression", "patch_text": "--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-a\n+b\n", "test_command": "python -m pytest && echo bad"})
    assert resp.status_code == 400


def test_verify_rejects_command_substitution():
    resp = client.post("/api/verify", json={"sample_name": "case1_fix_no_regression", "patch_text": "--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-a\n+b\n", "test_command": "python -m pytest $(whoami)"})
    assert resp.status_code == 400


def test_patch_reject_null_bytes():
    try:
        patch_mod.validate_patch("--- a/x.py\n+++ b/x.py\n\x00@@ -1 +1 @@\n-a\n+b\n")
        assert False
    except PatchValidationError:
        pass


def test_patch_reject_binary():
    try:
        patch_mod.validate_patch("GIT binary patch\nliteral 0\n")
        assert False
    except PatchValidationError:
        pass


def test_patch_reject_absolute_path():
    try:
        patch_mod.validate_patch("--- a/C:/Windows/x\n+++ b/C:/Windows/x\n@@ -1 +1 @@\n-a\n+b\n")
        assert False
    except PatchValidationError:
        pass


def test_patch_reject_traversal():
    try:
        patch_mod.validate_patch("--- a/../../etc/passwd\n+++ b/../../etc/passwd\n@@ -1 +1 @@\n-a\n+b\n")
        assert False
    except PatchValidationError:
        pass


def test_patch_accept_valid_unified():
    assert patch_mod.validate_patch("--- a/mathlib.py\n+++ b/mathlib.py\n@@ -1 +1 @@\n-x\n+y\n") is True


def test_gemini_rejects_missing_fields():
    with patch('google.genai.Client') as mock_client:
        mock_resp = MagicMock()
        mock_resp.text = '{"bug_summary":"x"}'
        mock_client.return_value.models.generate_content.return_value = mock_resp
        with patch.dict(os.environ, {'GEMINI_API_KEY':'test'}):
            try:
                generate_patch('bug', {})
                assert False
            except GeminiError:
                pass


def test_gemini_rejects_empty_diff():
    with patch('google.genai.Client') as mock_client:
        mock_resp = MagicMock()
        mock_resp.text = '{"bug_summary":"x","likely_root_cause":"y","evidence":[],"proposed_unified_diff":"","suggested_tests":[],"limitations":[]}'
        mock_client.return_value.models.generate_content.return_value = mock_resp
        with patch.dict(os.environ, {'GEMINI_API_KEY':'test'}):
            try:
                generate_patch('bug', {})
                assert False
            except GeminiError:
                pass


def test_gemini_rejects_invalid_diff():
    with patch('google.genai.Client') as mock_client:
        mock_resp = MagicMock()
        mock_resp.text = '{"bug_summary":"x","likely_root_cause":"y","evidence":[],"proposed_unified_diff":"not a diff","suggested_tests":[],"limitations":[]}'
        mock_client.return_value.models.generate_content.return_value = mock_resp
        with patch.dict(os.environ, {'GEMINI_API_KEY':'test'}):
            try:
                generate_patch('bug', {})
                assert False
            except GeminiError:
                pass


def test_docker_unavailable_runner_error():
    # In local mode (default), docker unavailable doesn't cause runner_error
    from app import config
    old = getattr(config.settings, 'execution_mode', 'local')
    try:
        config.settings.execution_mode = 'docker'
        with patch('app.executor._docker_available', return_value=False):
            d = Path(tempfile.mkdtemp())
            r = executor.run_tests(d)
            assert r.runner_error is True
            assert len(r.tests) == 0
    finally:
        config.settings.execution_mode = old



def test_run_tests_timeout_cleanup_path():
    with patch('app.executor._docker_available', return_value=True):
        with patch('subprocess.run') as mock_run:
            import subprocess
            mock_run.side_effect = subprocess.TimeoutExpired(cmd='x', timeout=1)
            d = Path(tempfile.mkdtemp())
            r = executor.run_tests(d)
            assert r.timed_out is True
