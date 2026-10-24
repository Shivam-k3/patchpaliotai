import tempfile
import shutil
from pathlib import Path
from .executor import apply_patch, run_tests
from .comparison import compare_results

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
