import os
from unittest.mock import patch, MagicMock
from app.gemini import generate_patch, GeminiError
import pytest

VALID_RESPONSE = '{"bug_summary":"x","likely_root_cause":"y","evidence":[],"proposed_unified_diff":"--- a/x.py\\n+++ b/x.py\\n@@ -1 +1 @@\\n-a\\n+b\\n","suggested_tests":[],"limitations":[]}'


def test_generate_patch_uses_env_key():
    with patch('google.genai.Client') as mock_client:
        mock_resp = MagicMock()
        mock_resp.text = VALID_RESPONSE
        mock_client.return_value.models.generate_content.return_value = mock_resp
        with patch.dict(os.environ, {'GEMINI_API_KEY':'test'}):
            result = generate_patch('bug', {})
            assert result['bug_summary'] == 'x'
            assert mock_client.return_value.models.generate_content.call_args.kwargs["model"] == "gemini-3.8-flash"


def test_generate_patch_uses_configured_gemini_model():
    with patch('google.genai.Client') as mock_client, patch.dict(
        os.environ, {'GEMINI_API_KEY': 'test', 'GEMINI_MODEL': 'demo-model'}
    ):
        mock_client.return_value.models.generate_content.return_value.text = VALID_RESPONSE

        generate_patch('bug', {})

        assert mock_client.return_value.models.generate_content.call_args.kwargs["model"] == "demo-model"


def test_generate_patch_accepts_fenced_json_response():
    with patch('google.genai.Client') as mock_client:
        mock_client.return_value.models.generate_content.return_value.text = f"```json\n{VALID_RESPONSE}\n```"
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}):
            result = generate_patch('bug', {})
        assert result["proposed_unified_diff"].startswith("--- a/x.py")


def test_generate_patch_extracts_json_from_surrounding_prose():
    with patch('google.genai.Client') as mock_client:
        mock_client.return_value.models.generate_content.return_value.text = f"Here is the result:\n{VALID_RESPONSE}\nDone."
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}):
            result = generate_patch('bug', {})
        assert result["bug_summary"] == "x"


def test_generate_patch_reports_invalid_diff_reason():
    invalid = VALID_RESPONSE.replace("--- a/x.py\\n+++ b/x.py\\n@@ -1 +1 @@\\n-a\\n+b", "not a diff")
    with patch('google.genai.Client') as mock_client:
        mock_client.return_value.models.generate_content.return_value.text = invalid
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}):
            with pytest.raises(GeminiError, match="proposed patch is not a valid unified diff"):
                generate_patch('bug', {})


def test_generate_patch_retries_transient_503():
    with patch('google.genai.Client') as mock_client, patch('app.gemini.time.sleep') as sleep:
        request = mock_client.return_value.models.generate_content
        request.side_effect = [RuntimeError("503 Service Unavailable"), RuntimeError("UNAVAILABLE"), MagicMock(text=VALID_RESPONSE)]
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}):
            result = generate_patch('bug', {})

        assert result['bug_summary'] == 'x'
        assert request.call_count == 3
        assert [call.args[0] for call in sleep.call_args_list] == [0.25, 0.5]


def test_generate_patch_stops_after_bounded_transient_retries():
    with patch('google.genai.Client') as mock_client, patch('app.gemini.time.sleep') as sleep:
        request = mock_client.return_value.models.generate_content
        request.side_effect = RuntimeError("503 Service Unavailable")
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}):
            with pytest.raises(GeminiError, match="temporarily unavailable"):
                generate_patch('bug', {})

        assert request.call_count == 3
        assert sleep.call_count == 2


def test_generate_patch_reports_exhausted_service_unavailability():
    with patch('google.genai.Client') as mock_client, patch('app.gemini.time.sleep'):
        mock_client.return_value.models.generate_content.side_effect = RuntimeError("503 Service Unavailable")
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}):
            with pytest.raises(GeminiError, match="temporarily unavailable"):
                generate_patch('bug', {})


def test_generate_patch_does_not_retry_authentication_failure():
    with patch('google.genai.Client') as mock_client, patch('app.gemini.time.sleep') as sleep:
        request = mock_client.return_value.models.generate_content
        request.side_effect = RuntimeError("401 UNAUTHENTICATED")
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}):
            with pytest.raises(GeminiError, match="authentication or permission failed"):
                generate_patch('bug', {})

        assert request.call_count == 1
        sleep.assert_not_called()


def test_generate_patch_reports_rate_limit_without_retrying():
    with patch('google.genai.Client') as mock_client, patch('app.gemini.time.sleep') as sleep:
        request = mock_client.return_value.models.generate_content
        request.side_effect = RuntimeError("429 RESOURCE_EXHAUSTED")
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test'}):
            with pytest.raises(GeminiError, match="quota or rate limit exceeded"):
                generate_patch('bug', {})

        assert request.call_count == 1
        sleep.assert_not_called()

def test_generate_patch_missing_key():
    with patch.dict(os.environ, {}, clear=True), patch("app.gemini.settings.gemini_api_key", None):
        try:
            generate_patch('b', {})
        except GeminiError as e:
            assert 'GEMINI_API_KEY' in str(e)
        else:
            assert False

def test_generate_patch_api_error():
    with patch('google.genai.Client') as mock_client, patch('app.gemini.time.sleep') as sleep:
        mock_client.return_value.models.generate_content.side_effect = Exception('boom')
        with patch.dict(os.environ, {'GEMINI_API_KEY':'k'}):
            try:
                generate_patch('b', {})
            except GeminiError:
                assert mock_client.return_value.models.generate_content.call_count == 1
                sleep.assert_not_called()
            else:
                assert False
