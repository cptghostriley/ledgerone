import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_firm, get_current_user
from app.core.database import get_db
from app.models.models import Firm, QnAMessage, QnASession, User
from app.services.llm import Gemma4OllamaService
from app.services.query import answer_client_query

logger = logging.getLogger(__name__)
router = APIRouter()


class SessionCreateReq(BaseModel):
    client_id: Optional[str] = None


class SessionRes(BaseModel):
    id: str
    session_name: str
    client_id: Optional[str]


class MessageReq(BaseModel):
    content: str


class MessageRes(BaseModel):
    id: str
    role: str
    content: str


@router.get("/sessions", response_model=List[SessionRes])
async def get_sessions(
    client_id: Optional[str] = None,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(QnASession).where(QnASession.user_id == user.id)
    if client_id:
        query = query.where(QnASession.client_id == client_id)
    query = query.order_by(desc(QnASession.created_at))
    result = await db.execute(query)
    sessions = result.scalars().all()

    return [
        SessionRes(id=str(session.id), session_name=session.session_name or "New Chat", client_id=str(session.client_id) if session.client_id else None)
        for session in sessions
    ]


@router.post("/sessions", response_model=SessionRes)
async def create_session(
    req: SessionCreateReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    new_session = QnASession(user_id=user.id, client_id=req.client_id, session_name="New Chat")
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return SessionRes(
        id=str(new_session.id),
        session_name=new_session.session_name,
        client_id=str(new_session.client_id) if new_session.client_id else None,
    )


@router.get("/sessions/{session_id}/messages", response_model=List[MessageRes])
async def get_messages(
    session_id: str,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(QnAMessage).where(QnAMessage.session_id == session_id).order_by(QnAMessage.created_at)
    result = await db.execute(query)
    messages = result.scalars().all()
    return [MessageRes(id=str(message.id), role=message.role, content=message.content) for message in messages]


@router.post("/sessions/{session_id}/messages", response_model=MessageRes)
async def add_message(
    session_id: str,
    req: MessageReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session_query = await db.execute(
        select(QnASession).where(QnASession.id == session_id, QnASession.user_id == user.id)
    )
    qna_session = session_query.scalar_one_or_none()
    if not qna_session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_msg = QnAMessage(session_id=qna_session.id, role="user", content=req.content)
    db.add(user_msg)
    await db.flush()

    query_result = await answer_client_query(db, firm.id, qna_session.client_id, req.content)
    ai_reply = query_result.get("answer", "I could not generate an answer for this client query right now.")

    ai_msg = QnAMessage(session_id=qna_session.id, role="ai", content=ai_reply)
    db.add(ai_msg)

    existing_messages = await db.execute(
        select(QnAMessage).where(QnAMessage.session_id == qna_session.id).order_by(QnAMessage.created_at)
    )
    conversation = existing_messages.scalars().all()
    if len(conversation) <= 2:
        llm_service = Gemma4OllamaService()
        title_prompt = (
            f"Summarize this Chartered Accountant client question into a short title with 2 to 4 words. "
            f"Question: {req.content}"
        )
        try:
            title = await llm_service.chat(
                [
                    {"role": "user", "content": title_prompt},
                ],
                temperature=0.2,
                num_ctx=2048,
            )
            qna_session.session_name = title.strip().strip('"') or "New Chat"
        except Exception:
            pass

    await db.commit()
    await db.refresh(ai_msg)

    return MessageRes(id=str(ai_msg.id), role=ai_msg.role, content=ai_msg.content)
