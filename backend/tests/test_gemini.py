import os
from unittest.mock import patch, MagicMock
from app.gemini import generate_patch, GeminiError
import pytest

def test_generate_patch_uses_env_key():
    with patch('google.genai.Client') as mock_client:
        mock_resp = MagicMock()
        mock_resp.text = '{"bug_summary":"x","likely_root_cause":"y","evidence":[],"proposed_unified_diff":"--- a/x.py\\n+++ b/x.py\\n@@ -1 +1 @@\\n-a\\n+b\\n","suggested_tests":[],"limitations":[]}'
        mock_client.return_value.models.generate_content.return_value = mock_resp
        with patch.dict(os.environ, {'GEMINI_API_KEY':'test'}):
            result = generate_patch('bug', {})
            assert result['bug_summary'] == 'x'

def test_generate_patch_missing_key():
    with patch.dict(os.environ, {}, clear=True):
        try:
            generate_patch('b', {})
        except GeminiError as e:
            assert 'GEMINI_API_KEY' in str(e)
        else:
            assert False

def test_generate_patch_api_error():
    with patch('google.genai.Client') as mock_client:
        mock_client.return_value.models.generate_content.side_effect = Exception('boom')
        with patch.dict(os.environ, {'GEMINI_API_KEY':'k'}):
            try:
                generate_patch('b', {})
            except GeminiError:
                pass
            else:
                assert False
