"""Bounded, content-free telemetry. No request bodies, SQL, or credentials."""

import json
import logging
from collections import defaultdict
from contextvars import ContextVar
from threading import Lock
from time import perf_counter
from typing import Any
from uuid import UUID

from sqlalchemy import event
from sqlalchemy.engine import Connection, Engine, ExceptionContext

request_id_context: ContextVar[UUID | None] = ContextVar("request_id", default=None)
actor_context: ContextVar[str | None] = ContextVar("actor", default=None)
logger = logging.getLogger("unispot.events")


def log_event(event_name: str, **fields: object) -> None:
    logger.info(json.dumps({"event": event_name, **fields}, separators=(",", ":")))


def configure_logging() -> None:
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


class Metrics:
    """Process-local counters; labels must be static codes or route templates."""

    def __init__(self) -> None:
        self.lock = Lock()
        self.values: dict[str, float] = defaultdict(float)

    def add(self, name: str, value: float = 1) -> None:
        with self.lock:
            self.values[name] += value

    def snapshot(self) -> dict[str, float]:
        with self.lock:
            return dict(self.values)


metrics = Metrics()


def install_database_metrics(engine: Engine) -> None:
    @event.listens_for(engine, "before_cursor_execute")
    def before(
        conn: Connection,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        conn.info["metric_started"] = perf_counter()

    @event.listens_for(engine, "after_cursor_execute")
    def after(
        conn: Connection,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        metrics.add("database_queries_total")
        started = conn.info.pop("metric_started", None)
        if started is not None:
            metrics.add("database_seconds_total", perf_counter() - started)

    @event.listens_for(engine, "handle_error")
    def failed(context: ExceptionContext) -> None:
        metrics.add("database_errors_total")
        if context.connection is not None:
            started = context.connection.info.pop("metric_started", None)
            if started is not None:
                metrics.add("database_seconds_total", perf_counter() - started)
