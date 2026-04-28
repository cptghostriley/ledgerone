from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import SchemaDef, Firm, User
from app.api.deps import get_current_firm, get_current_user
from app.core.response import create_response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

router = APIRouter()

class SchemaCreate(BaseModel):
    name: str
    fields: List[Dict[str, Any]]
    description: Optional[str] = None
    doc_type: Optional[str] = None

@router.get("")
async def get_schemas(
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SchemaDef).where(SchemaDef.firm_id == firm.id, SchemaDef.user_id == user.id))
    schemas = result.scalars().all()
    out = []
    for s in schemas:
        out.append({
            "id": str(s.id),
            "name": s.name,
            "fields": s.fields,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    return create_response(data=out)

@router.post("")
async def create_schema(
    data: SchemaCreate,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    schema_def = SchemaDef(
        firm_id=firm.id,
        user_id=user.id,
        name=data.name,
        fields=data.fields
    )
    db.add(schema_def)
    await db.commit()
    await db.refresh(schema_def)
    return create_response(data={"id": str(schema_def.id), "name": schema_def.name, "fields": schema_def.fields})
