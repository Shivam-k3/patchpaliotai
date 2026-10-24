from __future__ import annotations

from typing import Any, Dict


class PatchPilotError(Exception):
    """Base exception for PatchPilot."""
    pass


class ValidationError(PatchPilotError):
    pass


class PatchValidationError(PatchPilotError):
    pass


class ExecutionError(PatchPilotError):
    pass


class GeminiError(PatchPilotError):
    pass


class SampleNotFoundError(PatchPilotError):
    pass


ERROR_SCHEMA_EXAMPLE = {
    "error": "Human readable message",
    "code": "ERROR_CODE",
    "details": {}
}
