from datetime import datetime, timedelta

from fastapi import HTTPException


def validate_date_filters(start: datetime | None, end: datetime | None) -> None:
    if any(value is not None and value.tzinfo is None for value in (start, end)):
        raise HTTPException(422, "Date filters must include a timezone")
    if start is not None and end is not None:
        if end <= start or end - start > timedelta(days=366):
            raise HTTPException(422, "Date filters must be ordered and span at most 366 days")
