from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.api import SAMPLES_DIR, list_samples
from app.executor import run_tests


FIXTURE_NAME = "presentation_divide_fix"


def test_presentation_fixture_is_registered_with_failing_baseline():
    fixture = SAMPLES_DIR / FIXTURE_NAME

    assert FIXTURE_NAME in list_samples()
    result = run_tests(fixture, "python -m pytest -v")

    assert result.exit_code == 1
    assert result.runner_error is False
    assert result.timed_out is False
    assert result.tests
    assert all(test.status == "FAILED" for test in result.tests)
