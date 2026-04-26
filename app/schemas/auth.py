from pydantic import BaseModel, EmailStr
from uuid import UUID

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str | None = None
    firm_id: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class FirmCreate(BaseModel):
    email: EmailStr
    password: str
    firm_name: str

class UserOut(BaseModel):
    id: UUID
    firm_id: UUID
    email: EmailStr
    role: str
    is_active: bool
    
    class Config:
        from_attributes = True

class FirmOut(BaseModel):
    id: UUID
    name: str
    plan: str
    
    class Config:
        from_attributes = True
