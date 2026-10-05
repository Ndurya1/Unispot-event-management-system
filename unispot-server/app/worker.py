"""Run with python -m app.worker; SIGTERM safely ends the bounded worker loop."""

import asyncio
import signal

from sqlalchemy import delete, func

from app.core.config import get_settings
from app.core.observability import configure_logging, log_event
from app.db.session import AsyncSessionFactory, dispose_engine
from app.models.rate_limit import RateLimitBucket
from app.services.assistant_conversation import purge_expired_conversations
from app.services.notification_worker import process_pending_notifications


async def run() -> None:
    configure_logging()
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(signum, stop.set)
        except NotImplementedError:  # Windows developer consoles use Ctrl-C.
            pass
    try:
        while not stop.is_set():
            try:
                async with AsyncSessionFactory() as session:
                    result = await process_pending_notifications(session)
                    purged = await purge_expired_conversations(session)
                    await session.execute(
                        delete(RateLimitBucket).where(RateLimitBucket.expires_at < func.now())
                    )
                    await session.commit()
                    log_event(
                        "worker_batch",
                        delivered=result.delivered,
                        retried=result.retried,
                        failed=result.failed,
                        conversations_purged=purged,
                    )
            except Exception:
                log_event("worker_batch_failed")
            try:
                await asyncio.wait_for(stop.wait(), get_settings().worker_interval_seconds)
            except TimeoutError:
                pass
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(run())
