from app.workflow import Workflow
from app.api import SAMPLES_DIR
from pathlib import Path
import tempfile
import shutil
from unittest.mock import patch

def test_workflow_inconclusive_on_bad_patch():
    w = Workflow()
    # bad patch should give INCONCLUSIVE
    r = w.verify(SAMPLES_DIR / 'case1_fix_no_regression', 'not a diff')
    assert r['classification'] == 'INCONCLUSIVE'
