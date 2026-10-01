import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user_role import UserRoles


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    role_name: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        nullable=False
    )

    user_roles: Mapped[list["UserRoles"]] = relationship(
        "UserRoles",
        back_populates="role",
        cascade="all, delete-orphan"
    )
