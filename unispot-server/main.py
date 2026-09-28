"""Compatibility entry point for ``uvicorn main:app``.

The application package lives under :mod:`app`; new commands should prefer
``uvicorn app.main:app``.
"""

from app.main import app

__all__ = ["app"]
