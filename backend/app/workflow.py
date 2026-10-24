import tempfile
import shutil
from pathlib import Path
from .executor import apply_patch, run_tests
from .comparison import compare_results
from .models import CommandResult, TestRun
from .project_executor import run_project_build, run_project_tests
from .projects import ProjectSpec

class Workflow:
    def verify(self, sample_dir: Path, patch_text: str, test_command: str = "python -m pytest -v"):
        # Baseline
        with tempfile.TemporaryDirectory() as td:
            base = Path(td) / "base"
            shutil.copytree(sample_dir, base)
            baseline = run_tests(base, test_command)
            if baseline.timed_out or baseline.runner_error:
                return {"classification": "INCONCLUSIVE", "baseline": baseline.model_dump() if hasattr(baseline, "model_dump") else baseline.__dict__, "patched": {"tests": [], "runner_error": True}, "error": "execution_failed_or_unavailable"}
        # Patched
        with tempfile.TemporaryDirectory() as td:
            patched_dir = Path(td) / "patched"
            shutil.copytree(sample_dir, patched_dir)
            try:
                apply_patch(patch_text, patched_dir)
            except Exception as e:
                return {"classification": "INCONCLUSIVE", "error": str(e), "baseline": baseline.model_dump() if hasattr(baseline, "model_dump") else baseline.__dict__, "patched": {"tests": [], "runner_error": True}}
            patched = run_tests(patched_dir, test_command)
            if patched.timed_out or patched.runner_error:
                return {"classification": "INCONCLUSIVE", "baseline": baseline.model_dump() if hasattr(baseline, "model_dump") else baseline.__dict__, "patched": patched.model_dump() if hasattr(patched, "model_dump") else patched.__dict__, "error": "execution_failed_or_unavailable"}
        classification = compare_results(baseline, patched)
        return {
            "classification": classification,
            "baseline": baseline.model_dump() if hasattr(baseline, "model_dump") else baseline.__dict__,
            "patched": patched.model_dump() if hasattr(patched, "model_dump") else patched.__dict__,
        }

    def verify_project(self, project: ProjectSpec, patch_text: str):
        def serialize(value):
            return value.model_dump() if hasattr(value, "model_dump") else value.__dict__

        def serialize_run(test_run, build_run):
            result = serialize(test_run)
            result["build"] = serialize(build_run)
            return result

        def incomplete(test_run, build_run):
            return (
                test_run.timed_out
                or test_run.runner_error
                or not test_run.tests
                or build_run.timed_out
                or build_run.runner_error
                or build_run.exit_code != 0
            )

        with tempfile.TemporaryDirectory() as td:
            base = Path(td) / "base"
            shutil.copytree(project.root, base)
            baseline = run_project_tests(base, project.test_command)
            baseline_build = run_project_build(base, project.build_command)
            if (
                incomplete(baseline, baseline_build)
            ):
                return {
                    "classification": "INCONCLUSIVE",
                    "baseline": serialize_run(baseline, baseline_build),
                    "patched": serialize_run(
                        TestRun(tests=[], runner_error=True, logs="Patched execution was not started."),
                        CommandResult(runner_error=True),
                    ),
                    "error": "execution_failed_or_unavailable",
                }

        with tempfile.TemporaryDirectory() as td:
            patched_dir = Path(td) / "patched"
            shutil.copytree(project.root, patched_dir)
            try:
                apply_patch(patch_text, patched_dir)
            except Exception as exc:
                return {
                    "classification": "INCONCLUSIVE",
                    "error": str(exc),
                    "baseline": serialize_run(baseline, baseline_build),
                    "patched": serialize_run(
                        TestRun(tests=[], runner_error=True, logs="Patch application failed; patched execution was not started."),
                        CommandResult(runner_error=True),
                    ),
                }
            patched = run_project_tests(patched_dir, project.test_command)
            patched_build = run_project_build(patched_dir, project.build_command)
            if (
                incomplete(patched, patched_build)
            ):
                classification = "INCONCLUSIVE"
                error = "execution_failed_or_unavailable"
            else:
                classification = compare_results(baseline, patched)
                if baseline_build.exit_code != 0 or patched_build.exit_code != 0:
                    classification = "INCONCLUSIVE"
                error = None
            return {
                "classification": classification,
                "baseline": serialize_run(baseline, baseline_build),
                "patched": serialize_run(patched, patched_build),
                **({"error": error} if error else {}),
            }
