import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from .models import TestRun, TestOutcome
from .patch import validate_patch, PatchValidationError

class ExecutionError(Exception):
    pass


def _docker_available() -> bool:
    try:
        result = subprocess.run(["docker", "info"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        return result.returncode == 0
    except Exception:
        return False


def apply_patch(patch_text: str, workdir: Path) -> None:
    validate_patch(patch_text)
    patch_file = workdir / "_patch.diff"
    patch_file.write_text(patch_text, encoding="utf-8")
    try:
        result = subprocess.run(["git", "apply", "--whitespace=nowarn", str(patch_file)], cwd=str(workdir), capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            try:
                patch_file.unlink(missing_ok=True)
            except Exception:
                pass
            return
        result2 = subprocess.run(["git", "apply", "-p1", "--whitespace=nowarn", str(patch_file)], cwd=str(workdir), capture_output=True, text=True, timeout=30)
        if result2.returncode == 0:
            try:
                patch_file.unlink(missing_ok=True)
            except Exception:
                pass
            return
        raise ExecutionError(f"patch failed")
    except ExecutionError:
        raise
    except Exception as e:
        raise ExecutionError(str(e))
    finally:
        try:
            patch_file.unlink(missing_ok=True)
        except Exception:
            pass


def run_tests(workdir: Path, test_command: str = "python -m pytest -v") -> TestRun:
    if not _docker_available():
        # Do not run untrusted tests on host - return inconclusive
        return TestRun(tests=[], runner_error=True)
    
    try:
        # Mount workspace read-write but isolated; run as non-root where possible
        # Use disposable container
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
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        return TestRun(tests=[], timed_out=True)
    except Exception:
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
