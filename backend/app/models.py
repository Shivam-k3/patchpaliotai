from typing import Dict, Any, List, Literal
from pydantic import BaseModel

Classification = Literal[
    "IMPROVED",
    "REGRESSION_DETECTED",
    "PARTIAL_FIX",
    "NO_IMPROVEMENT",
    "INCONCLUSIVE",
]

class TestOutcome(BaseModel):
    test_id: str
    status: Literal["PASSED", "FAILED", "ERROR", "TIMEOUT", "SKIPPED"]

class TestRun(BaseModel):
    tests: List[TestOutcome]
    exit_code: int | None = None
    timed_out: bool = False
    runner_error: bool = False
    passed_count: int = 0
    failed_count: int = 0
    error_count: int = 0
    skipped_count: int = 0
    total_count: int = 0
    logs: str | None = None


class CommandResult(BaseModel):
    exit_code: int | None = None
    timed_out: bool = False
    runner_error: bool = False
    logs: str | None = None
