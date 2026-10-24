from app.models import TestRun, TestOutcome
from app.comparison import compare_results

def test_improved():
    baseline = TestRun(tests=[TestOutcome(test_id="t1", status="FAILED")])
    patched = TestRun(tests=[TestOutcome(test_id="t1", status="PASSED")])
    assert compare_results(baseline, patched) == "IMPROVED"

def test_regression():
    baseline = TestRun(tests=[TestOutcome(test_id="t1", status="PASSED")])
    patched = TestRun(tests=[TestOutcome(test_id="t1", status="FAILED")])
    assert compare_results(baseline, patched) == "REGRESSION_DETECTED"

def test_partial_fix():
    baseline = TestRun(tests=[TestOutcome(test_id="t1", status="FAILED"), TestOutcome(test_id="t2", status="FAILED")])
    patched = TestRun(tests=[TestOutcome(test_id="t1", status="PASSED"), TestOutcome(test_id="t2", status="FAILED")])
    assert compare_results(baseline, patched) == "PARTIAL_FIX"

def test_no_improvement():
    baseline = TestRun(tests=[TestOutcome(test_id="t1", status="FAILED")])
    patched = TestRun(tests=[TestOutcome(test_id="t1", status="FAILED")])
    assert compare_results(baseline, patched) == "NO_IMPROVEMENT"

def test_inconclusive_timeout():
    baseline = TestRun(tests=[], timed_out=True)
    patched = TestRun(tests=[])
    assert compare_results(baseline, patched) == "INCONCLUSIVE"
