from __future__ import annotations

import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    log_level = getattr(logging, level.upper(), logging.INFO)
    root = logging.getLogger()
    if root.handlers:
        # Update level if handlers exist
        root.setLevel(log_level)
        for h in root.handlers:
            h.setLevel(log_level)
        return
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
    )
    handler.setFormatter(formatter)
    root.addHandler(handler)
    root.setLevel(log_level)


__all__ = ["setup_logging"]
