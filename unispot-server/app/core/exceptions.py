class DatabaseUnavailableError(RuntimeError):
    """Raised when PostgreSQL cannot serve a request."""
