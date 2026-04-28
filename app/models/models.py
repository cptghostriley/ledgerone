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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    users = relationship("User", back_populates="firm")
    clients = relationship("Client", back_populates="firm")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firm_id = Column(UUID(as_uuid=True), ForeignKey("firms.id"), nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="staff") # owner, manager, staff
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    firm = relationship("Firm", back_populates="users")

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
