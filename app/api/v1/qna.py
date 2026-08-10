import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
import ollama

from app.core.database import get_db
from app.api.deps import get_current_firm, get_current_user
from app.models.models import Firm, User, Client, QnASession, QnAMessage, ComplianceDeadline, ReconciliationResult, MissingDocument, Document
from app.core.config import settings

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
    db: AsyncSession = Depends(get_db)
):
    query = select(QnASession).where(QnASession.user_id == user.id)
    if client_id:
        query = query.where(QnASession.client_id == client_id)
    query = query.order_by(desc(QnASession.created_at))
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    return [SessionRes(id=str(s.id), session_name=s.session_name or "New Chat", client_id=str(s.client_id) if s.client_id else None) for s in sessions]

@router.post("/sessions", response_model=SessionRes)
async def create_session(
    req: SessionCreateReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_session = QnASession(
        user_id=user.id,
        client_id=req.client_id,
        session_name="New Chat"
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return SessionRes(id=str(new_session.id), session_name=new_session.session_name, client_id=str(new_session.client_id) if new_session.client_id else None)

@router.get("/sessions/{session_id}/messages", response_model=List[MessageRes])
async def get_messages(
    session_id: str,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(QnAMessage).where(QnAMessage.session_id == session_id).order_by(QnAMessage.created_at)
    result = await db.execute(query)
    messages = result.scalars().all()
    return [MessageRes(id=str(m.id), role=m.role, content=m.content) for m in messages]

@router.post("/sessions/{session_id}/messages", response_model=MessageRes)
async def add_message(
    session_id: str,
    req: MessageReq,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch Session
    session_query = await db.execute(select(QnASession).where(QnASession.id == session_id, QnASession.user_id == user.id))
    qna_session = session_query.scalar_one_or_none()
    if not qna_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # 2. Save User Message
    user_msg = QnAMessage(session_id=qna_session.id, role="user", content=req.content)
    db.add(user_msg)
    await db.commit()
    
    # 3. Pass 1: Query Classifier
    classifier_prompt = f"""
    You are a query classifier. Based on the user's query, determine what data needs to be fetched from the database to answer it.
    User Query: "{req.content}"
    Output ONLY a valid JSON object with boolean flags:
    {{
        "requires_deadlines": true/false,
        "requires_recon": true/false,
        "requires_missing_docs": true/false,
        "requires_metadata": true/false
    }}
    """
    
    context_data = {}
    try:
        class_res = ollama.chat(
            model=settings.ollama_model,
            messages=[{"role": "user", "content": classifier_prompt}],
            options={"temperature": 0.0, "format": "json"}
        )
        flags = json.loads(class_res['message']['content'])
    except Exception as e:
        logger.error(f"Classifier error: {{e}}")
        flags = {"requires_deadlines": True, "requires_recon": True, "requires_missing_docs": True, "requires_metadata": True} # fallback fetch all
        
    # 4. Fetch Context
    if qna_session.client_id:
        if flags.get("requires_metadata"):
            client = await db.execute(select(Client).where(Client.id == qna_session.client_id))
            c = client.scalar_one_or_none()
            if c:
                context_data["client_profile"] = {"name": c.name, "pan": c.pan, "gstin": c.gstin, "metadata": c.client_metadata}
                
        if flags.get("requires_deadlines"):
            deadlines = await db.execute(select(ComplianceDeadline).where(ComplianceDeadline.client_id == qna_session.client_id))
            context_data["deadlines"] = [{"type": d.deadline_type, "date": str(d.due_date), "status": d.status} for d in deadlines.scalars().all()]
            
        if flags.get("requires_recon"):
            recon = await db.execute(select(ReconciliationResult).where(ReconciliationResult.client_id == qna_session.client_id).order_by(desc(ReconciliationResult.created_at)).limit(1))
            latest = recon.scalar_one_or_none()
            if latest:
                context_data["reconciliation"] = {"status": latest.status, "summary": latest.summary, "flags": latest.flagged_count}
                
        if flags.get("requires_missing_docs"):
            missing = await db.execute(select(MissingDocument).where(MissingDocument.client_id == qna_session.client_id))
            context_data["missing_documents"] = [{"type": m.document_type, "status": m.status, "required_for": m.required_for} for m in missing.scalars().all()]
            
    # 5. Pass 2: Generator
    system_prompt = f"""
    You are a professional AI assistant for a Chartered Accountant (CA). 
    Use the following retrieved context about the client to answer the user's query accurately. 
    If the context does not contain the answer, say you don't have that information.
    Context: {json.dumps(context_data, indent=2)}
    """
    
    # fetch previous messages for history (limit 5)
    hist_query = await db.execute(select(QnAMessage).where(QnAMessage.session_id == session_id).order_by(QnAMessage.created_at))
    history = hist_query.scalars().all()
    
    messages = [{"role": "system", "content": system_prompt}]
    for h in history[-6:]: # include the new user msg
        messages.append({"role": "user" if h.role == "user" else "assistant", "content": h.content})
        
    try:
        gen_res = ollama.chat(
            model=settings.ollama_model,
            messages=messages,
            options={"temperature": 0.3}
        )
        ai_reply = gen_res['message']['content']
    except Exception as e:
        logger.error(f"Generator error: {{e}}")
        ai_reply = "I'm sorry, I encountered an error while processing your request."
        
    # Save AI Message
    ai_msg = QnAMessage(session_id=qna_session.id, role="ai", content=ai_reply)
    db.add(ai_msg)
    
    # Check if first message, then auto-name session
    if len(history) == 1:
        name_prompt = f"Summarize this user query into a short title (2-4 words). Query: {req.content}"
        try:
            name_res = ollama.chat(model=settings.ollama_model, messages=[{"role": "user", "content": name_prompt}])
            title = name_res['message']['content'].strip('\"').strip()
            qna_session.session_name = title
        except:
            pass
            
    await db.commit()
    await db.refresh(ai_msg)
    
    return MessageRes(id=str(ai_msg.id), role=ai_msg.role, content=ai_msg.content)
