from fastapi import Request
from jose import jwt, JWTError
from app.core.config import settings

async def firm_isolation_middleware(request: Request, call_next):
    # Extracts firm_id from JWT and attaches to request state
    request.state.firm_id = None
    auth = request.headers.get("authorization")
    if auth and auth.startswith("Bearer "):
        token = auth.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
            request.state.firm_id = payload.get("firm_id")
        except JWTError:
            pass
            
    response = await call_next(request)
    return response
