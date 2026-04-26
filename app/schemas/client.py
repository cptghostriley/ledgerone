from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime

class ClientBase(BaseModel):
    name: str
    pan: Optional[str] = None
    gstin: Optional[str] = None
    filing_type: Optional[str] = None
    ay: Optional[str] = None
    contact_info: Optional[Dict[str, Any]] = None

class ClientCreate(ClientBase):
    pass

class ClientOut(ClientBase):
    id: UUID
    firm_id: UUID
    
    class Config:
        from_attributes = True
