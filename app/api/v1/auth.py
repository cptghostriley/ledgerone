import random
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import verify_password, get_password_hash, create_access_token
from app.models.models import User, Firm, UserFirmMapping, Invite
from app.schemas.auth import Token, UserLogin, FirmCreate, UserOut, FirmOut, GoogleLoginRequest, AdminOTPRequest, AdminOTPVerify, AdminActivateRequest, JoinFirmRequest, ApproveUserRequest, SignupRequest
from app.core.response import create_response
from app.api.deps import get_current_user, get_current_firm
from app.services.mail import send_otp_email, notify_admin_new_registration

# In-memory OTP store (keyed by email)
OTP_STORE: dict[str, str] = {}

router = APIRouter()


@router.post("/register")
async def register_firm(
    data: FirmCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    import string
    import hashlib
    
    firm_key_raw = "FRN-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    admin_key_raw = "".join(random.choices(string.ascii_letters + string.digits, k=32))
    
    firm = Firm(
        name=data.firm_name,
        firm_key_hash=hashlib.sha256(firm_key_raw.encode()).hexdigest(),
        one_time_admin_key_hash=hashlib.sha256(admin_key_raw.encode()).hexdigest()
    )
    db.add(firm)
    await db.commit()

    background_tasks.add_task(notify_admin_new_registration, data.firm_name, data.email)

    return create_response(
        data={
            "firm_name": firm.name,
            "firm_key": firm_key_raw,
            "admin_key": admin_key_raw
        }
    )


@router.post("/login")
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    mapping_result = await db.execute(select(UserFirmMapping).where(UserFirmMapping.user_id == user.id))
    mapping = mapping_result.scalars().first()
    if not mapping:
        raise HTTPException(status_code=400, detail="User is not assigned to any firm")

    access_token = create_access_token(subject=str(user.id), firm_id=str(mapping.firm_id))
    return create_response(
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": str(user.id), "email": user.email},
        }
    )


@router.post("/google")
async def google_login(data: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    import os
    from google.oauth2 import id_token
    from google.auth.transport import requests

    try:
        client_id = os.environ.get("VITE_GOOGLE_CLIENT_ID", "")
        idinfo = id_token.verify_oauth2_token(data.token, requests.Request())

        email = idinfo.get("email")
        if not email:
            raise ValueError("Token didn't contain an email")

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=400,
                detail="Email not registered. Please register your firm first.",
            )

        if not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")

        mapping_result = await db.execute(select(UserFirmMapping).where(UserFirmMapping.user_id == user.id))
        mapping = mapping_result.scalars().first()
        if not mapping:
            raise HTTPException(status_code=400, detail="User is not assigned to any firm")

        access_token = create_access_token(subject=str(user.id), firm_id=str(mapping.firm_id))
        return create_response(
            data={
                "access_token": access_token,
                "token_type": "bearer",
                "user": {"id": str(user.id), "email": user.email},
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid Google token: {str(e)}")


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user), firm: Firm = Depends(get_current_firm)
):
    return create_response(
        data={
            "user": UserOut.model_validate(user).model_dump(),
            "firm": FirmOut.model_validate(firm).model_dump(),
        }
    )


@router.post("/admin-login-otp")
async def admin_login_otp(
    data: AdminOTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized as admin")

    otp = str(random.randint(100000, 999999))
    OTP_STORE[data.email] = otp

    # Send OTP email in background
    success = send_otp_email(data.email, otp)
    if not success:
        # Log it to console as fallback so admin can still log in during dev
        import logging
        logging.getLogger(__name__).warning(f"OTP for {data.email}: {otp}")

    return create_response(data={"message": "OTP sent to email"})


@router.post("/admin-login")
async def admin_login(data: AdminOTPVerify, db: AsyncSession = Depends(get_db)):
    if data.email not in OTP_STORE or OTP_STORE[data.email] != data.otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    del OTP_STORE[data.email]

    mapping_result = await db.execute(select(UserFirmMapping).where(UserFirmMapping.user_id == user.id))
    mapping = mapping_result.scalars().first()
    firm_id = str(mapping.firm_id) if mapping else ""

    access_token = create_access_token(subject=str(user.id), firm_id=firm_id)
    return create_response(
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": str(user.id), "email": user.email, "is_admin": True},
        }
    )

@router.post("/activate-admin")
async def activate_admin(
    data: AdminActivateRequest,
    db: AsyncSession = Depends(get_db)
):
    import hashlib
    admin_key_hash = hashlib.sha256(data.admin_key.encode()).hexdigest()
    
    result = await db.execute(select(Firm).where(Firm.one_time_admin_key_hash == admin_key_hash))
    firm = result.scalar_one_or_none()
    
    if not firm:
        raise HTTPException(status_code=400, detail="Invalid or expired admin key")
        
    user_result = await db.execute(select(User).where(User.email == data.email))
    if user_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already exists")
        
    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        icai_membership_number=data.icai_membership_number
    )
    db.add(user)
    await db.flush()
    
    mapping = UserFirmMapping(
        user_id=user.id,
        firm_id=firm.id,
        role="Admin/Owner",
        status="active"
    )
    db.add(mapping)
    
    firm.one_time_admin_key_hash = None
    await db.commit()
    
    access_token = create_access_token(subject=str(user.id), firm_id=str(firm.id))
    return create_response(data={"access_token": access_token, "token_type": "bearer", "user": {"id": str(user.id), "email": user.email}})


@router.post("/signup")
async def signup_user(data: SignupRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        icai_membership_number=data.icai_membership_number
    )
    db.add(user)
    await db.commit()
    
    access_token = create_access_token(subject=str(user.id), firm_id="")
    return create_response(data={"access_token": access_token, "token_type": "bearer", "user": {"id": str(user.id), "email": user.email}})


@router.post("/join-firm")
async def join_firm(
    data: JoinFirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import hashlib
    firm_key_hash = hashlib.sha256(data.firm_key.encode()).hexdigest()
    
    result = await db.execute(select(Firm).where(Firm.firm_key_hash == firm_key_hash))
    firm = result.scalar_one_or_none()
    
    if not firm:
        raise HTTPException(status_code=400, detail="Invalid firm key")
        
    existing = await db.execute(select(UserFirmMapping).where(UserFirmMapping.user_id == current_user.id, UserFirmMapping.firm_id == firm.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already requested to join this firm")
        
    mapping = UserFirmMapping(
        user_id=current_user.id,
        firm_id=firm.id,
        role=data.assigned_role,
        status="pending_approval"
    )
    db.add(mapping)
    await db.commit()
    
    return create_response(data={"message": "Join request submitted. Pending admin approval."})


@router.get("/pending-approvals")
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_firm: Firm = Depends(get_current_firm)
):
    result = await db.execute(
        select(UserFirmMapping, User)
        .join(User)
        .where(UserFirmMapping.firm_id == current_firm.id, UserFirmMapping.status == "pending_approval")
    )
    approvals = []
    for mapping, user in result.all():
        approvals.append({
            "mapping_id": str(mapping.id),
            "user_id": str(user.id),
            "email": user.email,
            "role": mapping.role,
            "icai_number": user.icai_membership_number
        })
    return create_response(data=approvals)


@router.patch("/approve-user")
async def approve_user(
    data: ApproveUserRequest,
    db: AsyncSession = Depends(get_db),
    current_firm: Firm = Depends(get_current_firm),
    current_user: User = Depends(get_current_user)
):
    admin_check = await db.execute(
        select(UserFirmMapping).where(UserFirmMapping.user_id == current_user.id, UserFirmMapping.firm_id == current_firm.id)
    )
    admin_map = admin_check.scalar_one_or_none()
    if not admin_map or admin_map.role != "Admin/Owner":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    import uuid
    result = await db.execute(
        select(UserFirmMapping)
        .where(UserFirmMapping.user_id == uuid.UUID(data.user_id), UserFirmMapping.firm_id == current_firm.id)
    )
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
        
    if data.action == "approve":
        mapping.status = "active"
        user_res = await db.execute(select(User).where(User.id == mapping.user_id))
        target_user = user_res.scalar_one_or_none()
        if target_user:
            import logging
            logging.getLogger(__name__).info(f"EMAIL TO {target_user.email}: You have been verified by the firm. Login here: https://app.yourdomain.com/")
    elif data.action == "reject":
        await db.delete(mapping)
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    await db.commit()
    return create_response(data={"message": f"User {data.action}d successfully"})
