import uuid
from typing import Any, Generic, TypeVar, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
from app.core.config import settings

T = TypeVar("T")

class ErrorDetail(BaseModel):
    code: str
    message: str

class MetaDetail(BaseModel):
    request_id: str
    timestamp: str
    version: str

class APIResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[ErrorDetail] = None
    meta: MetaDetail

def create_response(data: Any = None, success: bool = True, error: Optional[ErrorDetail] = None) -> APIResponse:
    return APIResponse(
        success=success,
        data=data,
        error=error,
        meta=MetaDetail(
            request_id=str(uuid.uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
            version=settings.app_version
        )
    )
