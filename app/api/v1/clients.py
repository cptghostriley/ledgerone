from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.models import Client, Firm
from app.schemas.client import ClientCreate, ClientOut
from app.api.deps import get_current_firm, get_or_404
from app.core.response import create_response

router = APIRouter()

@router.get("", response_model=dict)
async def get_clients(
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Client).where(Client.firm_id == firm.id))
    clients = result.scalars().all()
    # Add status mocked for now based on what frontend expects
    out = []
    for c in clients:
        co = ClientOut.model_validate(c).model_dump()
        co['status'] = 'active'
        out.append(co)
    return create_response(data=out)

@router.post("", response_model=dict)
async def create_client(
    data: ClientCreate,
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    client = Client(
        firm_id=firm.id,
        **data.model_dump()
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return create_response(data=ClientOut.model_validate(client).model_dump())

@router.get("/{client_id}", response_model=dict)
async def get_client(
    client_id: UUID,
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    client = await get_or_404(db, Client, client_id, firm.id)
    out = ClientOut.model_validate(client).model_dump()
    out['status'] = 'active'
    return create_response(data=out)
