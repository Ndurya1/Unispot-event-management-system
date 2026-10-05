from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_venue_admin
from app.api.dependencies.database import get_db
from app.models.facility import Facility
from app.models.user import User
from app.schemas.venue import FacilityCreate, FacilityResponse
from app.services.venue_service import (
    create_facility,
    delete_facility,
    list_facilities,
    update_facility,
)

router = APIRouter(prefix="/facilities", tags=["facilities"])


@router.post("", response_model=FacilityResponse, status_code=status.HTTP_201_CREATED)
async def create(
    data: FacilityCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_venue_admin)],
) -> Facility:
    try:
        return await create_facility(session, data.name, actor_id=current_user.id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.get("", response_model=list[FacilityResponse])
async def list_all(session: Annotated[AsyncSession, Depends(get_db)]) -> list[Facility]:
    return await list_facilities(session)


@router.patch("/{facility_id}", response_model=FacilityResponse)
async def update(
    facility_id: UUID,
    data: FacilityCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_venue_admin)],
) -> Facility:
    try:
        return await update_facility(
            session, facility_id, data.name, actor_id=current_user.id
        )
    except ValueError as error:
        code = 409 if "already" in str(error) else 404
        raise HTTPException(status_code=code, detail=str(error)) from error


@router.delete("/{facility_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(
    facility_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_venue_admin)],
) -> Response:
    try:
        await delete_facility(session, facility_id)
    except ValueError as error:
        code = 409 if "linked" in str(error) else 404
        raise HTTPException(status_code=code, detail=str(error)) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
