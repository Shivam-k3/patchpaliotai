from __future__ import annotations

import os
from typing import List

try:
    from pydantic_settings import BaseSettings
    from pydantic import Field
    PERSISTENT_SETTINGS = True
except Exception:
    BaseSettings = object  # type: ignore
    Field = lambda *args, **kwargs: None  # type: ignore
    PERSISTENT_SETTINGS = False


class Settings:
    def __init__(self) -> None:
        # Core
        self.app_name = os.getenv("APP_NAME", "PatchPilot AI")
        self.env = os.getenv("ENV", "development")
        self.log_level = os.getenv("LOG_LEVEL", "INFO").upper()
        
        # CORS
        cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
        self.cors_origins: List[str] = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
        
        # Gemini
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = os.getenv("MODEL_NAME") or "gemini-flash-latest"
        self.gemini_timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "60"))
        
        # Execution
        self.execution_mode = os.getenv("EXECUTION_MODE", "local").lower()  # "local" or "docker"
        self.docker_timeout_seconds = int(os.getenv("DOCKER_TIMEOUT_SECONDS", "600"))
        self.patch_apply_timeout_seconds = int(os.getenv("PATCH_APPLY_TIMEOUT_SECONDS", "30"))
        self.docker_info_timeout_seconds = int(os.getenv("DOCKER_INFO_TIMEOUT_SECONDS", "10"))
        self.local_timeout_seconds = int(os.getenv("LOCAL_TIMEOUT_SECONDS", "300"))
        
        # Limits
        self.max_patch_size_bytes = int(os.getenv("MAX_PATCH_SIZE_BYTES", "1048576"))  # 1MB
        self.max_bug_report_chars = int(os.getenv("MAX_BUG_REPORT_CHARS", "10000"))
        self.max_files_count = int(os.getenv("MAX_FILES_COUNT", "100"))
        self.max_file_size_bytes = int(os.getenv("MAX_FILE_SIZE_BYTES", "1048576"))
        # Allowed test commands (exact or safe patterns)
        self.allowed_test_commands = [
            "python -m pytest",
            "python -m pytest -v",
            "pytest",
            "pytest -v",
        ]


if PERSISTENT_SETTINGS:
    class SettingsModel(BaseSettings):
        app_name: str = Field(default="PatchPilot AI")
        env: str = Field(default="development")
        log_level: str = Field(default="INFO")
        
        cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000")
        gemini_api_key: str | None = Field(default=None)
        model_name: str = Field(default="gemini-flash-latest")
        gemini_timeout_seconds: int = Field(default=60, ge=1, le=300)
        
        execution_mode: str = Field(default="local")
        docker_timeout_seconds: int = Field(default=600, ge=10, le=3600)
        patch_apply_timeout_seconds: int = Field(default=30, ge=1, le=300)
        docker_info_timeout_seconds: int = Field(default=10, ge=1, le=60)
        local_timeout_seconds: int = Field(default=300, ge=10, le=3600)
        
        max_patch_size_bytes: int = Field(default=1048576, ge=1)
        max_bug_report_chars: int = Field(default=10000, ge=1)
        max_files_count: int = Field(default=100, ge=1)
        max_file_size_bytes: int = Field(default=1048576, ge=1)
        
        class Config:
            env_file = ".env"
            env_file_encoding = "utf-8"
            case_sensitive = False
    
    _sm = SettingsModel()
    settings = Settings()
    # Override with validated values
    settings.app_name = _sm.app_name
    settings.env = _sm.env
    settings.log_level = _sm.log_level.upper()
    settings.cors_origins = [o.strip() for o in _sm.cors_origins.split(",") if o.strip()]
    settings.gemini_api_key = _sm.gemini_api_key
    settings.model_name = _sm.model_name
    settings.gemini_timeout_seconds = _sm.gemini_timeout_seconds
    settings.execution_mode = getattr(_sm, "execution_mode", "local").lower()
    settings.docker_timeout_seconds = _sm.docker_timeout_seconds
    settings.patch_apply_timeout_seconds = _sm.patch_apply_timeout_seconds
    settings.docker_info_timeout_seconds = _sm.docker_info_timeout_seconds
    settings.local_timeout_seconds = getattr(_sm, "local_timeout_seconds", 300)
    settings.max_patch_size_bytes = _sm.max_patch_size_bytes
    settings.max_bug_report_chars = _sm.max_bug_report_chars
    settings.max_files_count = _sm.max_files_count
    settings.max_file_size_bytes = _sm.max_file_size_bytes
else:
    settings = Settings()

__all__ = ["settings", "Settings"]
