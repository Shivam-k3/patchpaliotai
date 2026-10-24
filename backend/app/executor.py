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


def _patch_target_paths(patch_text: str) -> set[Path]:
    paths: set[Path] = set()
    for line in patch_text.splitlines():
        if not (line.startswith("--- ") or line.startswith("+++ ")):
            continue
        raw_path = line[4:].split("\t", 1)[0].strip()
        if raw_path == "/dev/null":
            continue
        if raw_path.startswith(("a/", "b/")):
            raw_path = raw_path[2:]
        path = Path(raw_path)
        if path.is_absolute() or ".." in path.parts:
            continue
        paths.add(path)
    return paths


def _normalize_patch_targets(workdir: Path, patch_text: str) -> None:
    for relative_path in _patch_target_paths(patch_text):
        target = (workdir / relative_path).resolve()
        try:
            target.relative_to(workdir.resolve())
        except ValueError:
            continue
        if not target.is_file():
            continue
        data = target.read_bytes()
        if b"\x00" in data:
            continue
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            continue
        normalized = text.replace("\r\n", "\n").replace("\r", "\n")
        if normalized != text or data.startswith(b"\xef\xbb\xbf"):
            target.write_text(normalized, encoding="utf-8", newline="\n")


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
        _normalize_patch_targets(workdir, patch_text)
        patch_file.write_bytes(patch_text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8"))
        try:
            result = subprocess.run(["git", "apply", "--no-index", "--whitespace=nowarn", str(patch_file)], cwd=str(workdir), capture_output=True, text=True, timeout=settings.patch_apply_timeout_seconds)
            if result.returncode == 0:
                return
            result2 = subprocess.run(["git", "apply", "--no-index", "-p1", "--whitespace=nowarn", str(patch_file)], cwd=str(workdir), capture_output=True, text=True, timeout=settings.patch_apply_timeout_seconds)
            if result2.returncode == 0:
                return
            detail = (result2.stderr or result.stderr or "git apply failed").strip()
            raise ExecutionError(f"patch failed: {detail[-1000:]}")
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
    
    return TestRun(tests=_parse_test_output(result.stdout), exit_code=result.returncode)


def _parse_test_output(output: str) -> list[TestOutcome]:
    tests = []
    for line in output.splitlines():
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
    
    return tests


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
    
    return TestRun(tests=_parse_test_output(result.stdout), exit_code=result.returncode)
