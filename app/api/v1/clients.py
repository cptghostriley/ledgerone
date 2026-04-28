from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.models import Client, Firm
from app.schemas.client import ClientCreate, ClientOut
from app.api.deps import get_current_firm, get_or_404, get_current_user
from app.models.models import User
from app.core.response import create_response

router = APIRouter()

@router.get("")
async def get_clients(
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Client).where(Client.firm_id == firm.id))
    clients = result.scalars().all()
    out = []
    for c in clients:
        co = ClientOut.model_validate(c).model_dump()
        co['status'] = 'active'
        out.append(co)
    return create_response(data=out)

@router.post("")
async def create_client(
    data: ClientCreate,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Prevent duplicate by name within same firm
    existing = await db.execute(
        select(Client).where(
            and_(Client.firm_id == firm.id, Client.name == data.name)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"A client named '{data.name}' already exists in this firm.")

    client = Client(
        firm_id=firm.id,
        user_id=user.id,
        **data.model_dump()
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return create_response(data=ClientOut.model_validate(client).model_dump())

@router.get("/{client_id}")
async def get_client(
    client_id: UUID,
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    client = await get_or_404(db, Client, client_id, firm.id)
    out = ClientOut.model_validate(client).model_dump()
    out['status'] = 'active'
    return create_response(data=out)

@router.delete("/{client_id}")
async def delete_client(
    client_id: UUID,
    firm: Firm = Depends(get_current_firm),
    db: AsyncSession = Depends(get_db)
):
    client = await get_or_404(db, Client, client_id, firm.id)
    await db.delete(client)
    await db.commit()
    return create_response(data={"deleted": str(client_id)})
