import random
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import verify_password, get_password_hash, create_access_token
from app.models.models import User, Firm
from app.schemas.auth import Token, UserLogin, FirmCreate, UserOut, FirmOut, GoogleLoginRequest, AdminOTPRequest, AdminOTPVerify
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

    firm = Firm(name=data.firm_name)
    db.add(firm)
    await db.flush()

    user = User(
        firm_id=firm.id,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role="owner",
    )
    db.add(user)
    await db.commit()

    # Notify admin in background
    background_tasks.add_task(notify_admin_new_registration, data.firm_name, data.email)

    access_token = create_access_token(subject=str(user.id), firm_id=str(firm.id))
    return create_response(
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": str(user.id), "email": user.email},
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

    access_token = create_access_token(subject=str(user.id), firm_id=str(user.firm_id))
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

        access_token = create_access_token(subject=str(user.id), firm_id=str(user.firm_id))
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

    access_token = create_access_token(subject=str(user.id), firm_id=str(user.firm_id))
    return create_response(
        data={
            "access_token": access_token,
            "token_type": "bearer",
            "user": {"id": str(user.id), "email": user.email, "is_admin": True},
        }
    )
