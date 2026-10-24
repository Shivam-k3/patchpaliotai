from unittest.mock import patch, MagicMock
from app import executor
from app.models import TestRun
from pathlib import Path
import tempfile

def test_docker_unavailable_returns_runner_error():
    from app import config
    old = getattr(config.settings, 'execution_mode', 'local')
    try:
        config.settings.execution_mode = 'docker'
        with patch('app.executor._docker_available', return_value=False):
            d = Path(tempfile.mkdtemp())
            r = executor.run_tests(d)
            assert r.runner_error is True
            assert len(r.tests) == 0
    finally:
        config.settings.execution_mode = old


def test_run_tests_timeout():
    with patch('app.executor._docker_available', return_value=True):
        with patch('subprocess.run') as mock_run:
            import subprocess
            mock_run.side_effect = subprocess.TimeoutExpired(cmd='x', timeout=1)
            d = Path(tempfile.mkdtemp())
            r = executor.run_tests(d)
            assert r.timed_out is True

def test_run_tests_parses():
    with patch('app.executor._docker_available', return_value=True):
        with patch('subprocess.run') as mock_run:
            mock_res = MagicMock()
            mock_res.returncode = 0
            mock_res.stdout = 'test_x.py::test_a PASSED\ntest_x.py::test_b FAILED\n'
            mock_res.stderr = ''
            mock_run.return_value = mock_res
            d = Path(tempfile.mkdtemp())
            r = executor.run_tests(d)
            assert len(r.tests) == 2
            assert r.tests[0].status == 'PASSED'
            assert r.tests[1].status == 'FAILED'
