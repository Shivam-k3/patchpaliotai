import os
import shutil
import subprocess
import tempfile
from pathlib import Path
import logging
from .models import TestRun, TestOutcome
from .patch import validate_patch, PatchValidationError
from .config import settings

logger = logging.getLogger("patchpilot.executor")


class ExecutionError(Exception):
    pass


def _docker_available() -> bool:
    try:
        result = subprocess.run(["docker", "info"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=settings.docker_info_timeout_seconds)
        return result.returncode == 0
    except Exception:
        logger.debug("Docker not available")
        return False


def apply_patch(patch_text: str, workdir: Path) -> None:
    validate_patch(patch_text)
    patch_file = workdir / "_patch.diff"
    try:
        patch_file.write_text(patch_text, encoding="utf-8")
        try:
            result = subprocess.run(["git", "apply", "--whitespace=nowarn", str(patch_file)], cwd=str(workdir), capture_output=True, text=True, timeout=settings.patch_apply_timeout_seconds)
            if result.returncode == 0:
                return
            result2 = subprocess.run(["git", "apply", "-p1", "--whitespace=nowarn", str(patch_file)], cwd=str(workdir), capture_output=True, text=True, timeout=settings.patch_apply_timeout_seconds)
            if result2.returncode == 0:
                return
            raise ExecutionError("patch failed")
        except ExecutionError:
            raise
        except Exception:
            raise ExecutionError("patch failed")
    finally:
        try:
            patch_file.unlink(missing_ok=True)
        except Exception:
            pass
        try:
            for p in workdir.glob("*.diff"):
                if p.name.startswith("_patch"):
                    p.unlink(missing_ok=True)
        except Exception:
            pass


def _run_tests_local(workdir: Path, test_command: str) -> TestRun:
    # Local execution - NOT a secure sandbox
    try:
        # Use argument list where possible; test_command is already validated by API
        # For safety, prefer splitting known patterns
        import shlex
        try:
            args = shlex.split(test_command)
        except Exception:
            args = ["python", "-m", "pytest", "-v"]
        result = subprocess.run(args, cwd=str(workdir), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=settings.local_timeout_seconds)
    except subprocess.TimeoutExpired:
        return TestRun(tests=[], timed_out=True)
    except Exception:
        logger.debug("Local execution failed")
        return TestRun(tests=[], runner_error=True)
    
    tests = []
    for line in result.stdout.splitlines():
        if "::" in line and ("PASSED" in line or "FAILED" in line or "ERROR" in line or "SKIPPED" in line):
            test_id = None
            for p in line.split():
                if "::" in p and p.strip():
                    test_id = p.strip().rstrip(',')
                    break
            if not test_id:
                continue
            status = "PASSED"
            l = line.upper()
            if "FAILED" in l:
                status = "FAILED"
            elif "ERROR" in l and "PASSED" not in l:
                status = "ERROR"
            elif "SKIPPED" in l:
                status = "SKIPPED"
            tests.append(TestOutcome(test_id=test_id, status=status))
    
    return TestRun(tests=tests, exit_code=result.returncode)


def run_tests(workdir: Path, test_command: str = "python -m pytest -v") -> TestRun:
    mode = getattr(settings, "execution_mode", "local").lower()
    if mode == "docker":
        if not _docker_available():
            return TestRun(tests=[], runner_error=True)
        try:
            cmd = [
                "docker", "run", "--rm",
                "--network", "none",
                "--read-only",
                "--tmpfs", "/tmp:rw,noexec,nosuid,size=512m",
                "--memory", "512m",
                "--cpus", "1.0",
                "--pids-limit", "256",
                "-v", f"{str(workdir.resolve())}:/app:rw",
                "-w", "/app",
                "--user", "1000:1000",
                "python:3.11-slim",
                "sh", "-c", f"pip install --no-cache-dir -q pytest 2>/dev/null; {test_command}"
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=settings.docker_timeout_seconds)
        except subprocess.TimeoutExpired:
            return TestRun(tests=[], timed_out=True)
        except Exception:
            logger.debug("Docker execution failed")
            return TestRun(tests=[], runner_error=True)
    else:
        return _run_tests_local(workdir, test_command)
    
    tests = []
    for line in result.stdout.splitlines():
        if "::" in line and ("PASSED" in line or "FAILED" in line or "ERROR" in line or "SKIPPED" in line):
            test_id = None
            for p in line.split():
                if "::" in p and p.strip():
                    test_id = p.strip().rstrip(',')
                    break
            if not test_id:
                continue
            status = "PASSED"
            l = line.upper()
            if "FAILED" in l:
                status = "FAILED"
            elif "ERROR" in l and "PASSED" not in l:
                status = "ERROR"
            elif "SKIPPED" in l:
                status = "SKIPPED"
            tests.append(TestOutcome(test_id=test_id, status=status))
    
    return TestRun(tests=tests, exit_code=result.returncode)

    
    tests = []
    for line in result.stdout.splitlines():
        if "::" in line and ("PASSED" in line or "FAILED" in line or "ERROR" in line or "SKIPPED" in line):
            test_id = None
            for p in line.split():
                if "::" in p and p.strip():
                    test_id = p.strip().rstrip(',')
                    break
            if not test_id:
                continue
            status = "PASSED"
            l = line.upper()
            if "FAILED" in l:
                status = "FAILED"
            elif "ERROR" in l and "PASSED" not in l:
                status = "ERROR"
            elif "SKIPPED" in l:
                status = "SKIPPED"
            tests.append(TestOutcome(test_id=test_id, status=status))
    
    return TestRun(tests=tests, exit_code=result.returncode)
