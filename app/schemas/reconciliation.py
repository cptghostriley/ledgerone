from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime
import uuid

class CheckResult(BaseModel):
    passed: bool
    details: Dict[str, Any]
    flagged_values: List[str]

class ReconciliationCheck(BaseModel):
    id: str
    name: str
    description: str
    severity: str

class ReconciliationReport(BaseModel):
    client_id: uuid.UUID
    financial_year: str
    checks: Dict[str, CheckResult]
    summary: Dict[str, Any]
    flagged_count: int
    created_at: datetime
