import uuid
import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

try:
    from pgvector.sqlalchemy import Vector as _Vector
    def VectorCol(dim: int):
        return Column(_Vector(dim))
except Exception:
    # pgvector not installed — fall back to Text so the app still starts
    def VectorCol(dim: int):
        return Column(Text)

Base = declarative_base()

class Firm(Base):
    __tablename__ = "firms"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    gstin = Column(String)
    plan = Column(String, default="standard")
    firm_key_hash = Column(String, unique=True, nullable=True) # made nullable temporarily for existing data
    one_time_admin_key_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user_mappings = relationship("UserFirmMapping", back_populates="firm")
    clients = relationship("Client", back_populates="firm")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    icai_membership_number = Column(String, nullable=True)

    firm_mappings = relationship("UserFirmMapping", back_populates="user")

class UserFirmMapping(Base):
    __tablename__ = "user_firm_mappings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    role = Column(String, nullable=False) # admin, partner, staff, article_clerk
    status = Column(String, default="pending_approval") # pending_approval, active, revoked

    user = relationship("User", back_populates="firm_mappings")
    firm = relationship("Firm", back_populates="user_mappings")

class Invite(Base):
    __tablename__ = "invites"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    email = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False)
    status = Column(String, default="pending") # pending/accepted/expired
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Client(Base):
    __tablename__ = "clients"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    pan = Column(String)
    gstin = Column(String)
    filing_type = Column(String)
    ay = Column(String)
    contact_info = Column(JSONB)
    client_metadata = Column('metadata', JSONB)

    firm = relationship("Firm", back_populates="clients")
    documents = relationship("Document", back_populates="client")

class SchemaDef(Base):
    __tablename__ = "schema_defs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    fields = Column(JSONB)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    mime_type = Column(String)
    doc_type = Column(String)
    financial_year = Column(String)
    status = Column(String, default="pending")
    extracted_data = Column(JSONB)
    anomalies = Column(JSONB)
    confidence = Column(Float)
    processing_ms = Column(Integer)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    client = relationship("Client", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    chunk_index = Column(Integer)
    raw_text = Column(String)
    extracted_data = Column(JSONB)
    embedding = VectorCol(768)

    document = relationship("Document", back_populates="chunks")

class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    financial_year = Column(String, nullable=False)
    checks = Column(JSONB)
    summary = Column(JSONB)
    flagged_count = Column(Integer)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class MissingDocument(Base):
    __tablename__ = "missing_documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    document_type = Column(String, nullable=False)
    required_for = Column(String)
    status = Column(String)
    notes = Column(Text)
    due_date = Column(DateTime)

class ComplianceDeadline(Base):
    __tablename__ = "compliance_deadlines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    deadline_type = Column(String, nullable=False)
    due_date = Column(DateTime, nullable=False)
    status = Column(String)
    notes = Column(Text)

class Job(Base):
    __tablename__ = "jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    task_name = Column(String)
    status = Column(String)
    payload = Column(JSONB)
    result = Column(JSONB)
    error = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime)

    user = relationship("User")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String)
    resource_type = Column(String)
    resource_id = Column(String)
    detail = Column(JSONB)
    ip = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")

class ClientHistory(Base):
    __tablename__ = "client_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String)
    detail = Column(JSONB)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class QnASession(Base):
    __tablename__ = "qna_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)
    session_name = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class QnAMessage(Base):
    __tablename__ = "qna_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("qna_sessions.id"), nullable=False)
    role = Column(String, nullable=False) # 'user' or 'ai'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class BankTransaction(Base):
    __tablename__ = "bank_transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    description = Column(String)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False) # 'dr' or 'cr'
    status = Column(String, default="unmatched") # unmatched, matched, queried

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    description = Column(String)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False) # 'dr' or 'cr'
    status = Column(String, default="unmatched")

class ReconMatch(Base):
    __tablename__ = "recon_matches"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bank_txn_id = Column(UUID(as_uuid=True), ForeignKey("bank_transactions.id"), nullable=True)
    ledger_entry_id = Column(UUID(as_uuid=True), ForeignKey("ledger_entries.id"), nullable=True)
    match_tier = Column(String) # exact, fuzzy, multi, manual
    confidence_score = Column(Float)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    match_meta = Column(JSONB)

class ReconPeriodLock(Base):
    __tablename__ = "recon_period_locks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    month_year = Column(String, nullable=False) # format YYYY-MM
    locked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    locked_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="locked")
