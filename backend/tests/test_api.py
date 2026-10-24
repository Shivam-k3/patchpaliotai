import re
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.api import SAMPLES_DIR, AnalyzeRequest, list_samples
from app.gemini import GeminiError
from app.main import app
from app.models import TestOutcome, TestRun

client = TestClient(app)
REPO_ROOT = Path(__file__).resolve().parents[2]
PATCH = "--- a/mathlib.py\n+++ b/mathlib.py\n@@ -1 +1 @@\n-x\n+y\n"


def test_samples_dir_points_at_repo_samples():
    assert SAMPLES_DIR == REPO_ROOT / "samples"
    assert SAMPLES_DIR.is_dir()


def test_list_samples_only_returns_real_sample_dirs():
    names = list_samples()
    assert names
    assert names == sorted(names)
    for name in names:
        assert (SAMPLES_DIR / name).is_dir()
        assert not name.startswith((".", "_"))


def test_samples_endpoint_returns_registry():
    resp = client.get("/api/samples")
    assert resp.status_code == 200
    assert resp.json()["samples"] == list_samples()


def test_verify_accepts_every_registered_sample():
    names = list_samples()
    assert names
    with patch("app.workflow.apply_patch"), patch(
        "app.workflow.run_tests",
        return_value=TestRun(tests=[TestOutcome(test_id="t", status="PASSED")]),
    ):
        for name in names:
            resp = client.post("/api/verify", json={"sample_name": name, "patch_text": PATCH})
            assert resp.status_code == 200, (name, resp.text)
            assert resp.json()["classification"]


def test_verify_unknown_sample_is_rejected():
    resp = client.post("/api/verify", json={"sample_name": "case02_partial_regression", "patch_text": PATCH})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "sample not found"


def test_verify_rejects_path_traversal():
    resp = client.post("/api/verify", json={"sample_name": "../../etc", "patch_text": PATCH})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "sample not found"


def test_verify_requires_sample_and_patch():
    assert client.post("/api/verify", json={"patch_text": PATCH}).status_code == 400
    name = next(iter(list_samples()), None)
    assert name is not None
    resp = client.post("/api/verify", json={"sample_name": name})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "patch required"


def test_analyze_uses_bug_report_and_files():
    with patch("app.api.generate_patch", return_value={"proposed_unified_diff": PATCH}) as gen:
        resp = client.post("/api/analyze", json={"bug_report": "divide by zero", "files": {"mathlib.py": "code"}})
    assert resp.status_code == 200
    assert resp.json()["proposed_unified_diff"] == PATCH
    gen.assert_called_once_with("divide by zero", {"mathlib.py": "code"})


def test_analyze_maps_gemini_error_to_502():
    with patch("app.api.generate_patch", side_effect=GeminiError("GEMINI_API_KEY not configured")):
        resp = client.post("/api/analyze", json={"bug_report": "x"})
    assert resp.status_code == 502
    assert resp.json()["detail"] == "GEMINI_API_KEY not configured"


def test_analyze_sends_registered_sample_files_to_gemini():
    with patch("app.api.generate_patch", return_value={"proposed_unified_diff": PATCH}) as gen:
        resp = client.post(
            "/api/analyze",
            json={"bug_report": "divide by zero", "sample_name": "case1_fix_no_regression"},
        )
    assert resp.status_code == 200
    bug_report, files = gen.call_args.args
    assert bug_report == "divide by zero"
    assert "mathlib.py" in files
    assert "def divide(a, b):" in files["mathlib.py"]
    assert all(not name.startswith((".", "_")) for name in files)
    assert not any(name.endswith(".diff") for name in files)


def test_analyze_rejects_unknown_sample():
    resp = client.post("/api/analyze", json={"bug_report": "x", "sample_name": "case02_partial_regression"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "sample not found"


def test_analyze_requires_bug_report():
    resp = client.post("/api/analyze", json={"bug_report": "   ", "sample_name": "case1_fix_no_regression"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "bug report required"


def test_frontend_uses_backend_sample_registry():
    src = (REPO_ROOT / "frontend" / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "/api/samples" in src
    for sample_id in set(re.findall(r"case\d\w*", src)):
        assert sample_id in list_samples()


def test_frontend_analyze_payload_matches_api_schema():
    src = (REPO_ROOT / "frontend" / "src" / "App.tsx").read_text(encoding="utf-8")
    assert "/api/analyze" in src
    for field in ("bug_report", "sample_name", "proposed_unified_diff"):
        assert field in src
    schema = AnalyzeRequest.model_fields
    assert "bug_report" in schema and "sample_name" in schema
