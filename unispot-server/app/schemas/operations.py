from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SystemSettingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    key: str
    value_json: dict[str, Any]
    description: str | None = None
    updated_by_user_id: UUID | None = None
    updated_at: datetime


class SystemSettingUpsert(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    value_json: dict[str, Any] = Field(default_factory=dict)
    description: str | None = Field(default=None, max_length=4000)


class PolicyRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    scope: str
    enabled: bool
    config_json: dict[str, Any]
    description: str | None = None
    updated_by_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class PolicyRuleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    scope: str = Field(default="BOOKING", min_length=1, max_length=40)
    enabled: bool = True
    config_json: dict[str, Any] = Field(default_factory=dict)
    description: str | None = Field(default=None, max_length=4000)


class PolicyRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    scope: str | None = Field(default=None, min_length=1, max_length=40)
    enabled: bool | None = None
    config_json: dict[str, Any] | None = None
    description: str | None = Field(default=None, max_length=4000)


class MaintenanceRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    asset_type: str
    asset_id: UUID | None = None
    asset_label: str
    title: str
    details: str | None = None
    status: str
    scheduled_for: datetime | None = None
    completed_at: datetime | None = None
    created_by_user_id: UUID | None = None
    created_at: datetime
    updated_at: datetime


class MaintenanceRecordCreate(BaseModel):
    asset_type: str = Field(min_length=1, max_length=40)
    asset_id: UUID | None = None
    asset_label: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    details: str | None = Field(default=None, max_length=4000)
    status: str = Field(default="SCHEDULED", min_length=1, max_length=40)
    scheduled_for: datetime | None = None


class MaintenanceRecordUpdate(BaseModel):
    asset_type: str | None = Field(default=None, min_length=1, max_length=40)
    asset_id: UUID | None = None
    asset_label: str | None = Field(default=None, min_length=1, max_length=200)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    details: str | None = Field(default=None, max_length=4000)
    status: str | None = Field(default=None, min_length=1, max_length=40)
    scheduled_for: datetime | None = None
    completed_at: datetime | None = None
