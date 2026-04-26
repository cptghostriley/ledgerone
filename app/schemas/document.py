import uuid
from typing import Any, Optional
from pydantic import BaseModel
from datetime import datetime

class DocumentUploadResponse(BaseModel):
    job_id: str

class DocumentOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    original_filename: str
    status: str
    doc_type: Optional[str] = None
    financial_year: Optional[str] = None
    confidence: Optional[float] = None
    
    class Config:
        from_attributes = True

class JobOut(BaseModel):
    id: uuid.UUID
    task_name: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
