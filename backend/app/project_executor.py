import os
import shutil
import subprocess
import re
from pathlib import Path

from .config import settings
from .executor import _parse_test_output
from .models import CommandResult, TestOutcome, TestRun

MAX_CAPTURED_OUTPUT = 20000


def _node_executable(command: tuple[str, ...]) -> tuple[str, ...]:
    if os.name == "nt" and command[0] == "npm":
        return ("npm.cmd", *command[1:])
    return command


def run_project_tests(workdir: Path, command: tuple[str, ...]) -> TestRun:
    executable = _node_executable(command)
    if shutil.which(executable[0]) is None:
        return TestRun(tests=[], runner_error=True, logs=f"Test executable not found: {executable[0]}")
    try:
        result = subprocess.run(
            list(executable),
            cwd=str(workdir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=settings.local_timeout_seconds,
            shell=False,
            env={**os.environ, "CI": "1"},
        )
    except subprocess.TimeoutExpired as exc:
        output = f"{exc.stdout or ''}\n{exc.stderr or ''}"
        return TestRun(tests=[], timed_out=True, logs=f"Test command timed out.\n{output[-MAX_CAPTURED_OUTPUT:]}")
    except OSError as exc:
        return TestRun(tests=[], runner_error=True, logs=f"Could not start test command: {exc}")
    output = f"{result.stdout or ''}\n{result.stderr or ''}"
    tests, counts = _parse_vitest_results(output)
    if not tests:
        tests = _parse_test_output(output)
        counts = _counts_from_outcomes(tests)
    return TestRun(
        tests=tests,
        exit_code=result.returncode,
        runner_error=not tests,
        **counts,
        logs=(
            output[-MAX_CAPTURED_OUTPUT:]
            if tests
            else f"Vitest produced no parseable test evidence (exit code {result.returncode}).\n"
            f"{output[-MAX_CAPTURED_OUTPUT:]}"
        ),
    )


def _parse_vitest_file_results(output: str):
    return _parse_vitest_results(output)[0]


def _parse_vitest_results(output: str) -> tuple[list[TestOutcome], dict[str, int]]:
    results = []
    output = re.sub(r"\x1b\[[0-9;]*m", "", output)
    pattern = re.compile(r"^\s*[✓❯×]\s+(\S+\.(?:test|spec)\.[cm]?[jt]sx?)\s+\((\d+)\s+tests?(?:\s*\|\s*(\d+)\s+failed)?", re.IGNORECASE)
    for line in output.splitlines():
        match = pattern.search(line)
        if not match:
            continue
        failed = int(match.group(3) or 0)
        results.append(
            TestOutcome(
                test_id=match.group(1),
                status="FAILED" if failed else "PASSED",
            )
        )
    counts = _counts_from_outcomes(results)
    summary = re.search(
        r"Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(?:(\d+)\s+passed)?"
        r"(?:\s*\|\s*(\d+)\s+skipped)?\s+\((\d+)\)",
        output,
        re.IGNORECASE,
    )
    if summary:
        failed, passed, skipped, total = (int(value or 0) for value in summary.groups())
        counts.update(
            failed_count=failed,
            passed_count=passed,
            skipped_count=skipped,
            total_count=total,
            error_count=max(0, total - failed - passed - skipped),
        )
    return results, counts


def _counts_from_outcomes(outcomes: list[TestOutcome]) -> dict[str, int]:
    counts = {
        "passed_count": sum(item.status == "PASSED" for item in outcomes),
        "failed_count": sum(item.status == "FAILED" for item in outcomes),
        "error_count": sum(item.status == "ERROR" for item in outcomes),
        "skipped_count": sum(item.status == "SKIPPED" for item in outcomes),
    }
    counts["total_count"] = len(outcomes)
    return counts


def run_project_build(workdir: Path, command: tuple[str, ...]) -> CommandResult:
    executable = _node_executable(command)
    if shutil.which(executable[0]) is None:
        return CommandResult(runner_error=True, logs="npm executable not found")
    try:
        result = subprocess.run(
            list(executable),
            cwd=str(workdir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=settings.local_timeout_seconds,
            shell=False,
        )
    except subprocess.TimeoutExpired:
        return CommandResult(timed_out=True, logs="Build command timed out")
    except OSError as exc:
        return CommandResult(runner_error=True, logs=str(exc))
    output = f"{result.stdout or ''}\n{result.stderr or ''}"
    return CommandResult(exit_code=result.returncode, logs=output[-MAX_CAPTURED_OUTPUT:])
