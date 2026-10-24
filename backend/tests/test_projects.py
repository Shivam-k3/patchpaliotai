from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api import workflow
from app.main import app
from app.models import CommandResult, TestOutcome, TestRun
from app.project_executor import _parse_vitest_file_results, _parse_vitest_results, run_project_tests
from app.projects import PROJECT_REGISTRY, ProjectSpec, resolve_project


client = TestClient(app)
PATCH = (
    "--- a/src/lib/validation.ts\n"
    "+++ b/src/lib/validation.ts\n"
    "@@ -9,1 +9,1 @@\n"
    "-  return { valid: false, message: \"Enter a valid email address.\" };;\n"
    "+  return { valid: true };\n"
)


def test_registered_project_is_listed_without_exposing_a_path():
    response = client.get("/api/projects")
    assert response.status_code == 200
    assert response.json()["projects"] == [{
        "id": "northstar-landing-page-bugtest",
        "label": "Northstar landing page bug test",
        "runtime": "node-local",
        "test_command": "npm.cmd test",
        "build_command": "npm.cmd run build",
    }]
    assert "C:\\" not in response.text


def test_unknown_and_traversal_project_ids_are_rejected():
    for project_id in ("missing", "../landing-page-lab-bugtest", "C:\\outside"):
        response = client.post(
            "/api/verify",
            json={"project_id": project_id, "patch_text": PATCH},
        )
        assert response.status_code == 400


def test_project_rejects_frontend_command_override():
    response = client.post(
        "/api/verify",
        json={
            "project_id": "northstar-landing-page-bugtest",
            "patch_text": PATCH,
            "test_command": "npm test && whoami",
        },
    )
    assert response.status_code == 400


def test_symlinked_project_root_is_rejected(tmp_path):
    target = tmp_path / "target"
    target.mkdir()
    link = tmp_path / "link"
    try:
        link.symlink_to(target, target_is_directory=True)
    except (OSError, NotImplementedError):
        return
    original = PROJECT_REGISTRY["northstar-landing-page-bugtest"]
    try:
        PROJECT_REGISTRY[original.project_id] = ProjectSpec(
            project_id=original.project_id,
            label=original.label,
            root=link,
            test_command=original.test_command,
            build_command=original.build_command,
            runtime=original.runtime,
        )
        try:
            resolve_project(original.project_id)
            assert False, "symlinked project root should be rejected"
        except ValueError as exc:
            assert "symlink" in str(exc)
    finally:
        PROJECT_REGISTRY[original.project_id] = original


def test_project_commands_are_fixed_and_shell_is_disabled():
    from app import project_executor

    with patch("app.project_executor.shutil.which", return_value="npm.cmd"), patch(
        "app.project_executor.subprocess.run"
    ) as run:
        run.return_value.returncode = 0
        run.return_value.stdout = " ✓ src/lib/validation.test.ts (10 tests)\n"
        run.return_value.stderr = ""
        project_executor.run_project_tests(Path("."), ("npm.cmd", "test"))
        args = run.call_args
        assert args.args[0] == ["npm.cmd", "test"]
        assert args.kwargs["shell"] is False


def test_vitest_file_results_capture_failed_and_passing_files():
    output = (
        " ❯ src/lib/validation.test.ts (10 tests | 2 failed)\n"
        " ✓ src/lib/pricing.test.ts (2 tests)\n"
    )
    results = _parse_vitest_file_results(output)
    assert [(item.test_id, item.status) for item in results] == [
        ("src/lib/validation.test.ts", "FAILED"),
        ("src/lib/pricing.test.ts", "PASSED"),
    ]


def test_vitest_results_capture_aggregate_counts():
    output = (
        " ✓ src/lib/pricing.test.ts (2 tests)\n"
        " ❯ src/lib/validation.test.ts (10 tests | 2 failed)\n"
        " ❯ src/App.test.tsx (3 tests | 1 failed)\n"
        " Tests 3 failed | 12 passed (15)\n"
    )
    results, counts = _parse_vitest_results(output)
    assert len(results) == 3
    assert counts == {
        "passed_count": 12,
        "failed_count": 3,
        "error_count": 0,
        "skipped_count": 0,
        "total_count": 15,
    }


def test_missing_vitest_output_is_runner_error():
    with patch("app.project_executor.shutil.which", return_value="npm.cmd"), patch(
        "app.project_executor.subprocess.run"
    ) as run:
        run.return_value.returncode = 1
        run.return_value.stdout = ""
        run.return_value.stderr = "command failed"
        result = run_project_tests(Path("."), ("npm.cmd", "test"))
    assert result.runner_error is True
    assert result.tests == []
    assert "command failed" in (result.logs or "")


def test_missing_dependencies_include_actionable_runner_output():
    with patch("app.project_executor.shutil.which", return_value="npm.cmd"), patch(
        "app.project_executor.subprocess.run"
    ) as run:
        run.return_value.returncode = 1
        run.return_value.stdout = ""
        run.return_value.stderr = "npm error missing: vitest"
        result = run_project_tests(Path("."), ("npm.cmd", "test"))
    assert result.runner_error is True
    assert "no parseable test evidence" in (result.logs or "")
    assert "vitest" in (result.logs or "")


def test_vitest_malformed_output_is_runner_error():
    with patch("app.project_executor.shutil.which", return_value="npm.cmd"), patch(
        "app.project_executor.subprocess.run"
    ) as run:
        run.return_value.returncode = 0
        run.return_value.stdout = "Tests completed successfully"
        run.return_value.stderr = ""
        result = run_project_tests(Path("."), ("npm.cmd", "test"))
    assert result.runner_error is True
    assert result.exit_code == 0


def test_project_test_timeout_is_explicit():
    import subprocess

    with patch("app.project_executor.shutil.which", return_value="npm.cmd"), patch(
        "app.project_executor.subprocess.run",
        side_effect=subprocess.TimeoutExpired(["npm.cmd", "test"], 300),
    ):
        result = run_project_tests(Path("."), ("npm.cmd", "test"))
    assert result.timed_out is True
    assert "timed out" in (result.logs or "").lower()


def test_project_verify_keeps_baseline_and_patched_evidence_separate():
    spec = resolve_project("northstar-landing-page-bugtest")
    baseline = TestRun(tests=[TestOutcome(test_id="validation", status="FAILED")], exit_code=1)
    patched = TestRun(tests=[TestOutcome(test_id="validation", status="PASSED")], exit_code=0)
    passing_build = CommandResult(exit_code=0)
    with patch("app.workflow.run_project_tests", side_effect=[baseline, patched]), patch(
        "app.workflow.run_project_build", return_value=passing_build
    ), patch("app.workflow.apply_patch"):
        result = workflow.verify_project(spec, PATCH)
    assert result["classification"] == "IMPROVED"
    assert result["baseline"]["exit_code"] == 1
    assert result["patched"]["exit_code"] == 0
    assert result["baseline"]["tests"][0]["status"] == "FAILED"
    assert result["patched"]["tests"][0]["status"] == "PASSED"
    assert result["baseline"]["build"]["exit_code"] == 0
    assert result["patched"]["build"]["exit_code"] == 0


def test_project_build_failure_is_inconclusive():
    spec = resolve_project("northstar-landing-page-bugtest")
    tests = TestRun(tests=[TestOutcome(test_id="validation", status="FAILED")], exit_code=1)
    with patch("app.workflow.run_project_tests", return_value=tests), patch(
        "app.workflow.run_project_build", return_value=CommandResult(exit_code=1)
    ):
        result = workflow.verify_project(spec, PATCH)
    assert result["classification"] == "INCONCLUSIVE"


def test_project_empty_test_evidence_is_inconclusive():
    spec = resolve_project("northstar-landing-page-bugtest")
    empty = TestRun(tests=[], exit_code=0)
    with patch("app.workflow.run_project_tests", return_value=empty), patch(
        "app.workflow.run_project_build", return_value=CommandResult(exit_code=0)
    ):
        result = workflow.verify_project(spec, PATCH)
    assert result["classification"] == "INCONCLUSIVE"


def test_project_root_is_not_modified_by_verification():
    spec = resolve_project("northstar-landing-page-bugtest")
    before = {
        path.relative_to(spec.root): path.read_bytes()
        for path in spec.root.rglob("*")
        if path.is_file() and "node_modules" not in path.parts and "dist" not in path.parts
    }
    with patch("app.workflow.run_project_tests", return_value=TestRun(tests=[], exit_code=1)), patch(
        "app.workflow.run_project_build", return_value=CommandResult(exit_code=1)
    ):
        workflow.verify_project(spec, PATCH)
    after = {
        path.relative_to(spec.root): path.read_bytes()
        for path in spec.root.rglob("*")
        if path.is_file() and "node_modules" not in path.parts and "dist" not in path.parts
    }
    assert before == after
