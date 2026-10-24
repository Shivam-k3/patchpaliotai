from typing import Dict, Any
from .models import TestRun, TestOutcome, Classification

def compare_results(baseline: TestRun, patched: TestRun) -> Classification:
    # If execution is broken
    if baseline.timed_out or baseline.runner_error:
        return "INCONCLUSIVE"
    if patched.timed_out or patched.runner_error:
        return "INCONCLUSIVE"
    
    base_by_id = {t.test_id: t for t in baseline.tests}
    patch_by_id = {t.test_id: t for t in patched.tests}
    
    all_ids = set(base_by_id.keys()) | set(patch_by_id.keys())
    
    # Check for regressions first
    for tid in all_ids:
        b = base_by_id.get(tid)
        p = patch_by_id.get(tid)
        if b and b.status == "PASSED" and p and p.status in ("FAILED", "ERROR", "TIMEOUT"):
            return "REGRESSION_DETECTED"
        if b and b.status == "PASSED" and tid not in patch_by_id:
            # Missing result counts as problematic if base passed
            return "INCONCLUSIVE"
    
    # Count improvements and new failures
    improved = 0
    still_failing_base = 0
    fixed = 0
    new_fail = 0
    
    for tid in all_ids:
        b = base_by_id.get(tid)
        p = patch_by_id.get(tid)
        if not p:
            continue
        if b and b.status == "FAILED" and p.status == "PASSED":
            fixed += 1
            improved += 1
        elif not b and p.status == "PASSED":
            improved += 1
        elif b and b.status == "FAILED" and p.status in ("FAILED", "ERROR", "TIMEOUT"):
            still_failing_base += 1
        elif b and b.status == "FAILED" and tid not in patch_by_id:
            return "INCONCLUSIVE"
    
    if fixed > 0 and still_failing_base == 0 and new_fail == 0:
        return "IMPROVED"
    if fixed > 0 and (still_failing_base > 0 or new_fail > 0):
        return "PARTIAL_FIX"
    if improved > 0 and fixed == 0 and new_fail == 0:
        return "IMPROVED"
    if fixed == 0 and improved == 0:
        return "NO_IMPROVEMENT"
    return "INCONCLUSIVE"
