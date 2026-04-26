from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User, Firm
from app.schemas.auth import TokenPayload

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        token_data = TokenPayload(**payload)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = token_data.sub
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token target")
        
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    return user

async def get_current_firm(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Firm:
    firm_id = user.firm_id
    result = await db.execute(select(Firm).where(Firm.id == firm_id))
    firm = result.scalar_one_or_none()
    
    if not firm:
        raise HTTPException(status_code=400, detail="Firm not found")
        
    # Standardize firm_id into request state for explicit multi-tenant access safely
    request.state.firm_id = str(firm_id)
    return firm

# The critical multi-tenant enforcing helper defined in the instructions (Section 5)
async def get_or_404(db: AsyncSession, Model, id: UUID, firm_id: UUID):
    """
    CRITICAL: Every single database query MUST include a WHERE firm_id = :firm_id clause. 
    Build a helper get_or_404(db, Model, id, firm_id) that raises 404 if the record doesn't belong to the requesting firm. 
    Use this everywhere. Never use db.get(Model, id) directly.
    """
    result = await db.execute(
        select(Model).where(Model.id == id, Model.firm_id == firm_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{Model.__name__} not found")
    return obj
