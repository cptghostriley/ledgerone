from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.middleware import firm_isolation_middleware
from app.api.v1 import documents, auth, clients, jobs, dashboard

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

# CORS Security Rules
allowed_origins = [origin.strip() for origin in settings.allowed_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enforce JWT Firm Multi-Tenant Isolation
app.add_middleware(BaseHTTPMiddleware, dispatch=firm_isolation_middleware)

# Standard Routers
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(clients.router, prefix="/api/v1/clients", tags=["clients"])
app.include_router(jobs.router, prefix="/api/v1/jobs", tags=["jobs"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])

@app.get("/health")
def health_check():
    return {"status": "ok", "version": settings.app_version, "multi_tenant_secure": True}
