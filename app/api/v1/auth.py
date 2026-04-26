from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import verify_password, get_password_hash, create_access_token
from app.models.models import User, Firm
from app.schemas.auth import Token, UserLogin, FirmCreate, UserOut, FirmOut
from app.core.response import create_response

router = APIRouter()

@router.post("/register")
async def register_firm(data: FirmCreate, db: AsyncSession = Depends(get_db)):
    # Check if email exists
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
        role="owner"
    )
    db.add(user)
    await db.commit()
    
    access_token = create_access_token(subject=str(user.id), firm_id=str(firm.id))
    return create_response(data={"access_token": access_token, "token_type": "bearer", "user": {"id": str(user.id), "email": user.email}})

@router.post("/login")
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token = create_access_token(subject=str(user.id), firm_id=str(user.firm_id))
    return create_response(data={"access_token": access_token, "token_type": "bearer", "user": {"id": str(user.id), "email": user.email}})
