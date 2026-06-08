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

class GoogleLoginRequest(BaseModel):
    token: str

class FirmCreate(BaseModel):
    email: EmailStr
    password: str
    firm_name: str

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    is_active: bool
    active_firm_id: UUID | None = None
    active_role: str | None = None
    
    class Config:
        from_attributes = True

class FirmOut(BaseModel):
    id: UUID
    name: str
    plan: str
    
    class Config:
        from_attributes = True

class AdminOTPRequest(BaseModel):
    email: EmailStr

class AdminOTPVerify(BaseModel):
    email: EmailStr
    otp: str

class AdminActivateRequest(BaseModel):
    admin_key: str
    email: EmailStr
    password: str
    icai_membership_number: str | None = None

class JoinFirmRequest(BaseModel):
    firm_key: str
    assigned_role: str

class ApproveUserRequest(BaseModel):
    user_id: str
    action: str # "approve" | "reject"

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    icai_membership_number: str | None = None

class InviteRequest(BaseModel):
    email: EmailStr
    role: str

class AcceptInviteRequest(BaseModel):
    token: str
    password: str | None = None
    icai_membership_number: str | None = None

class UpdateMemberRequest(BaseModel):
    user_id: str
    action: str # "change_designation" | "disable_access"
    role: str | None = None
