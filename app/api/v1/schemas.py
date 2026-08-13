from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.models import SchemaDef, Firm, User
from app.api.deps import get_current_firm, get_current_user
from app.core.response import create_response
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid

router = APIRouter()

class SchemaCreate(BaseModel):
    name: str
    fields: List[Dict[str, Any]]
    description: Optional[str] = None
    doc_type: Optional[str] = None
    category: Optional[str] = None

class SchemaUpdate(BaseModel):
    name: Optional[str] = None
    fields: Optional[List[Dict[str, Any]]] = None
    description: Optional[str] = None
    doc_type: Optional[str] = None
    category: Optional[str] = None

DEFAULT_SCHEMAS = [
    # 1. GST Compliance - GSTR-3B Summary
    {
        "name": "GSTR-3B Summary",
        "doc_type": "gstr",
        "category": "GST Compliance",
        "description": "Extracts key turnover, Taxable Output, and Input Tax Credit (ITC) figures from monthly GSTR-3B returns.",
        "fields": [
            {"name": "gstin", "type": "string", "description": "15-character GST Registration Number"},
            {"name": "legal_name", "type": "string", "description": "Legal name of the registered taxpayer"},
            {"name": "return_period", "type": "string", "description": "Tax period (MM/YYYY)"},
            {"name": "outward_taxable_value", "type": "currency", "description": "Total taxable value of outward taxable supplies"},
            {"name": "igst_output", "type": "currency", "description": "Integrated Tax on outward supplies"},
            {"name": "cgst_output", "type": "currency", "description": "Central Tax on outward supplies"},
            {"name": "sgst_output", "type": "currency", "description": "State/UT Tax on outward supplies"},
            {"name": "itc_all_other_igst", "type": "currency", "description": "Total ITC available on all other imports/inputs (IGST)"},
            {"name": "itc_all_other_cgst", "type": "currency", "description": "Total ITC available on all other imports/inputs (CGST)"},
            {"name": "itc_all_other_sgst", "type": "currency", "description": "Total ITC available on all other imports/inputs (SGST)"},
            {"name": "net_tax_paid_cash", "type": "currency", "description": "Total tax paid through electronic cash ledger"},
        ],
    },
    # 2. Direct Tax & Income Tax - Form 16 (Salary & TDS)
    {
        "name": "Form 16 - Salary & TDS",
        "doc_type": "form16",
        "category": "Direct Tax & Income Tax",
        "description": "Extracts gross salary, deductions under Chapter VI-A, and TDS details from employee Form 16 certificates.",
        "fields": [
            {"name": "pan_deductee", "type": "string", "description": "10-character PAN of the employee"},
            {"name": "tan_deductor", "type": "string", "description": "10-character TAN of the employer"},
            {"name": "assessment_year", "type": "string", "description": "Assessment Year (e.g., 2025-26)"},
            {"name": "employer_name", "type": "string", "description": "Name of the employer/organization"},
            {"name": "gross_salary_sec_17_1", "type": "currency", "description": "Salary as per provisions of section 17(1)"},
            {"name": "standard_deduction_sec_16_ia", "type": "currency", "description": "Standard deduction under section 16(ia)"},
            {"name": "total_chapter_vi_a_deductions", "type": "currency", "description": "Total eligible deductions under Chapter VI-A (80C, 80D, etc.)"},
            {"name": "total_taxable_income", "type": "currency", "description": "Total income chargeable under head Salaries"},
            {"name": "total_tax_deducted", "type": "currency", "description": "Total amount of tax deducted at source (TDS)"},
        ],
    },
    # 3. Accounting & Banking - Bank Statement Overview
    {
        "name": "Bank Statement Overview",
        "doc_type": "bank",
        "category": "Accounting & Banking",
        "description": "Extracts statement period, account details, closing balances, and aggregate debits/credits for audit reconciliation.",
        "fields": [
            {"name": "bank_name", "type": "string", "description": "Name of the banking institution"},
            {"name": "account_number", "type": "string", "description": "Bank account number"},
            {"name": "ifsc_code", "type": "string", "description": "11-character bank IFSC code"},
            {"name": "statement_start_date", "type": "date", "description": "Start date of statement period"},
            {"name": "statement_end_date", "type": "date", "description": "End date of statement period"},
            {"name": "opening_balance", "type": "currency", "description": "Account opening balance"},
            {"name": "total_credits_amount", "type": "currency", "description": "Aggregate sum of all credited transactions"},
            {"name": "total_debits_amount", "type": "currency", "description": "Aggregate sum of all debited transactions"},
            {"name": "closing_balance", "type": "currency", "description": "Final closing balance at statement end date"},
        ],
    },
    # 4. Direct Tax & Income Tax - TDS Credit Verification
    {
        "name": "TDS Credit Verification",
        "doc_type": "other",
        "category": "Direct Tax & Income Tax",
        "description": "Extracts Section 194/195 TDS vouchers from Form 26AS or Tax Deducted Certificates.",
        "fields": [
            {"name": "tan_of_deductor", "type": "string", "description": "TAN of the deductor"},
            {"name": "deductor_name", "type": "string", "description": "Name of the entity deducting tax"},
            {"name": "section_code", "type": "string", "description": "Income Tax Act section code (e.g. 194C, 194J, 194IA)"},
            {"name": "transaction_date", "type": "date", "description": "Date of credit or payment"},
            {"name": "amount_credited_paid", "type": "currency", "description": "Gross amount paid or credited"},
            {"name": "total_tds_deposited", "type": "currency", "description": "Total tax deducted and deposited"},
        ],
    },
    # 5. Accounting & Banking - Standard Tax Invoice / Purchase Bill
    {
        "name": "Tax Invoice",
        "doc_type": "other",
        "category": "Accounting & Banking",
        "description": "Extracts line-item independent invoice header details for GST input reconciliation.",
        "fields": [
            {"name": "invoice_number", "type": "string", "description": "Distinct invoice reference number"},
            {"name": "invoice_date", "type": "date", "description": "Date of invoice issuance"},
            {"name": "supplier_gstin", "type": "string", "description": "Supplier 15-digit GSTIN"},
            {"name": "supplier_name", "type": "string", "description": "Name of the supplier/vendor"},
            {"name": "recipient_gstin", "type": "string", "description": "Buyer/Client 15-digit GSTIN"},
            {"name": "total_taxable_value", "type": "currency", "description": "Total value subject to tax"},
            {"name": "cgst_amount", "type": "currency", "description": "CGST amount"},
            {"name": "sgst_amount", "type": "currency", "description": "SGST amount"},
            {"name": "igst_amount", "type": "currency", "description": "IGST amount"},
            {"name": "grand_total", "type": "currency", "description": "Final invoice bill total"},
        ],
    },
    # 6. Direct Tax & Income Tax - AIS / TIS Summary
    {
        "name": "AIS / TIS Summary",
        "doc_type": "form16",
        "category": "Direct Tax & Income Tax",
        "description": "Extracts income categories, gross amounts, and tax deducted reported by third parties to the Income Tax Department.",
        "fields": [
            {"name": "pan_taxpayer", "type": "string", "description": "10-character PAN of the taxpayer"},
            {"name": "financial_year", "type": "string", "description": "Financial Year (e.g. 2025-26)"},
            {"name": "gross_salary_reported", "type": "currency", "description": "Total salary received as per AIS"},
            {"name": "dividend_income", "type": "currency", "description": "Total dividend income received"},
            {"name": "interest_from_savings_bank", "type": "currency", "description": "Aggregate savings account interest (Sec 80TTA)"},
            {"name": "interest_from_deposit", "type": "currency", "description": "Fixed/Term deposit interest income (Sec 80TTB)"},
            {"name": "sale_of_securities_shares", "type": "currency", "description": "Gross proceeds from sale of shares/mutual funds"},
            {"name": "total_tds_reported", "type": "currency", "description": "Total TDS reflected in AIS"},
        ],
    },
    # 7. Direct Tax & Income Tax - Form 16A - Non-Salary TDS
    {
        "name": "Form 16A - Non-Salary TDS",
        "doc_type": "form16",
        "category": "Direct Tax & Income Tax",
        "description": "Extracts certificate number, section code, amount paid/credited, and tax deducted.",
        "fields": [
            {"name": "certificate_number", "type": "string", "description": "Unique TDS Certificate Number"},
            {"name": "tan_deductor", "type": "string", "description": "TAN of the deductor"},
            {"name": "pan_deductee", "type": "string", "description": "PAN of the client / deductee"},
            {"name": "section_code", "type": "string", "description": "Specific section (e.g., 194C, 194J, 194I)"},
            {"name": "total_amount_credited", "type": "currency", "description": "Total income/amount paid or credited"},
            {"name": "total_tds_deducted", "type": "currency", "description": "Total tax deducted at source"},
        ],
    },
    # 8. Direct Tax & Income Tax - Tax Payment Challan (ITNS 280 / ITNS 281)
    {
        "name": "Tax Payment Challan",
        "doc_type": "other",
        "category": "Direct Tax & Income Tax",
        "description": "Extracts BSR code, challan serial number, deposit date, and tax breakup for tallying audit books.",
        "fields": [
            {"name": "pan_tan", "type": "string", "description": "PAN or TAN against which tax was paid"},
            {"name": "bsr_code", "type": "string", "description": "7-digit BSR code of the receiving bank branch"},
            {"name": "challan_number", "type": "string", "description": "Challan Serial Number"},
            {"name": "tender_date", "type": "date", "description": "Date of tax deposit"},
            {"name": "assessment_year", "type": "string", "description": "Assessment Year applicable"},
            {"name": "major_head", "type": "string", "description": "0020 (Company) or 0021 (Non-Company)"},
            {"name": "minor_head", "type": "string", "description": "100 (Advance Tax), 300 (Self-Assessment), 400 (Tax on Regular Assessment)"},
            {"name": "tax_amount", "type": "currency", "description": "Basic tax amount"},
            {"name": "interest_amount", "type": "currency", "description": "Interest paid under Section 234A/B/C"},
            {"name": "total_challan_amount", "type": "currency", "description": "Final total amount deposited"},
        ],
    },
    # 9. GST Compliance - GSTR-2B ITC Statement
    {
        "name": "GSTR-2B ITC Statement",
        "doc_type": "gstr",
        "category": "GST Compliance",
        "description": "Extracts supplier-wise eligible and ineligible ITC for monthly purchase register matching.",
        "fields": [
            {"name": "recipient_gstin", "type": "string", "description": "Taxpayer's 15-character GSTIN"},
            {"name": "supplier_gstin", "type": "string", "description": "Supplier's 15-character GSTIN"},
            {"name": "supplier_trade_name", "type": "string", "description": "Supplier legal/trade name"},
            {"name": "invoice_number", "type": "string", "description": "Supplier invoice reference"},
            {"name": "invoice_date", "type": "date", "description": "Supplier invoice date"},
            {"name": "taxable_value", "type": "currency", "description": "Base taxable amount"},
            {"name": "igst", "type": "currency", "description": "Integrated GST"},
            {"name": "cgst", "type": "currency", "description": "Central GST"},
            {"name": "sgst", "type": "currency", "description": "State GST"},
            {"name": "itc_availability", "type": "string", "description": "\"Yes\" (Eligible) or \"No\" (Ineligible / Blocked Sec 17(5))"},
        ],
    },
    # 10. GST Compliance - E-Way Bill Summary
    {
        "name": "E-Way Bill Summary",
        "doc_type": "other",
        "category": "GST Compliance",
        "description": "Extracts E-Way bill number, transporter details, vehicle number, and goods value.",
        "fields": [
            {"name": "eway_bill_number", "type": "string", "description": "12-digit E-Way Bill Number"},
            {"name": "eway_bill_date", "type": "date", "description": "Date of E-Way Bill generation"},
            {"name": "generator_gstin", "type": "string", "description": "GSTIN of supplier/consignor"},
            {"name": "consignee_gstin", "type": "string", "description": "GSTIN of recipient"},
            {"name": "document_number", "type": "string", "description": "Tax Invoice / Delivery Challan number"},
            {"name": "transporter_id", "type": "string", "description": "Transporter ID / GSTIN"},
            {"name": "vehicle_number", "type": "string", "description": "Vehicle registration number"},
            {"name": "total_goods_value", "type": "currency", "description": "Aggregate value of transported goods"},
        ],
    },
    # 11. Financial Statements & Audit - Profit & Loss Statement
    {
        "name": "Profit & Loss Statement",
        "doc_type": "other",
        "category": "Financial Statements & Audit",
        "description": "Extracts top-line revenue, major expense heads, and net profit figures.",
        "fields": [
            {"name": "entity_name", "type": "string", "description": "Company / Firm legal name"},
            {"name": "financial_year", "type": "string", "description": "Financial period (e.g. FY 2024-25)"},
            {"name": "revenue_from_operations", "type": "currency", "description": "Turnover / Gross Sales"},
            {"name": "other_income", "type": "currency", "description": "Non-operational income"},
            {"name": "cost_of_materials_consumed", "type": "currency", "description": "Raw material / Stock consumption"},
            {"name": "employee_benefit_expenses", "type": "currency", "description": "Salaries, wages, PF, ESIC"},
            {"name": "finance_costs", "type": "currency", "description": "Bank interest and borrowing charges"},
            {"name": "depreciation_amortization", "type": "currency", "description": "Depreciation charged for the period"},
            {"name": "profit_before_tax", "type": "currency", "description": "PBT amount"},
            {"name": "net_profit_after_tax", "type": "currency", "description": "PAT amount"},
        ],
    },
    # 12. Financial Statements & Audit - Balance Sheet Overview
    {
        "name": "Balance Sheet Overview",
        "doc_type": "other",
        "category": "Financial Statements & Audit",
        "description": "Extracts major equity, liability, and asset heads as of financial year-end.",
        "fields": [
            {"name": "entity_name", "type": "string", "description": "Entity name"},
            {"name": "as_on_date", "type": "date", "description": "Balance Sheet date (e.g., 2026-03-31)"},
            {"name": "share_capital_partners_capital", "type": "currency", "description": "Share capital or Partner capital balance"},
            {"name": "reserves_and_surplus", "type": "currency", "description": "Accumulated profits / reserves"},
            {"name": "long_term_borrowings", "type": "currency", "description": "Secured/unsecured long-term loans"},
            {"name": "short_term_borrowings", "type": "currency", "description": "Working capital / CC limits"},
            {"name": "trade_payables", "type": "currency", "description": "Sundry Creditors balance"},
            {"name": "fixed_assets_net_block", "type": "currency", "description": "Property, plant, and equipment net value"},
            {"name": "trade_receivables", "type": "currency", "description": "Sundry Debtors balance"},
            {"name": "cash_and_bank_balances", "type": "currency", "description": "Total liquid cash and bank balances"},
        ],
    },
]

async def seed_defaults_if_empty(db: AsyncSession, firm_id: uuid.UUID, user_id: uuid.UUID):
    result = await db.execute(select(SchemaDef).where(SchemaDef.firm_id == firm_id, SchemaDef.user_id == user_id))
    existing = result.scalars().all()
    if not existing or len(existing) < 3:
        existing_names = {s.name for s in existing}
        for s in DEFAULT_SCHEMAS:
            if s["name"] not in existing_names:
                db.add(SchemaDef(
                    firm_id=firm_id,
                    user_id=user_id,
                    name=s["name"],
                    doc_type=s["doc_type"],
                    category=s["category"],
                    description=s["description"],
                    fields=s["fields"]
                ))
        await db.commit()

@router.get("")
async def get_schemas(
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await seed_defaults_if_empty(db, firm.id, user.id)
    result = await db.execute(
        select(SchemaDef)
        .where(SchemaDef.firm_id == firm.id, SchemaDef.user_id == user.id)
        .order_by(SchemaDef.created_at.asc())
    )
    schemas = result.scalars().all()
    out = []
    for s in schemas:
        out.append({
            "id": str(s.id),
            "name": s.name,
            "doc_type": s.doc_type,
            "category": s.category,
            "description": s.description,
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
        doc_type=data.doc_type,
        category=data.category,
        description=data.description,
        fields=data.fields
    )
    db.add(schema_def)
    await db.commit()
    await db.refresh(schema_def)
    return create_response(data={
        "id": str(schema_def.id),
        "name": schema_def.name,
        "doc_type": schema_def.doc_type,
        "category": schema_def.category,
        "description": schema_def.description,
        "fields": schema_def.fields,
        "created_at": schema_def.created_at.isoformat() if schema_def.created_at else None
    })

@router.put("/{schema_id}")
async def update_schema(
    schema_id: str,
    data: SchemaUpdate,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        sid = uuid.UUID(schema_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schema ID")

    result = await db.execute(select(SchemaDef).where(SchemaDef.id == sid, SchemaDef.firm_id == firm.id))
    schema_def = result.scalar_one_or_none()
    if not schema_def:
        raise HTTPException(status_code=404, detail="Schema not found")

    if data.name is not None:
        schema_def.name = data.name
    if data.doc_type is not None:
        schema_def.doc_type = data.doc_type
    if data.category is not None:
        schema_def.category = data.category
    if data.description is not None:
        schema_def.description = data.description
    if data.fields is not None:
        schema_def.fields = data.fields

    await db.commit()
    await db.refresh(schema_def)
    return create_response(data={
        "id": str(schema_def.id),
        "name": schema_def.name,
        "doc_type": schema_def.doc_type,
        "category": schema_def.category,
        "description": schema_def.description,
        "fields": schema_def.fields,
        "created_at": schema_def.created_at.isoformat() if schema_def.created_at else None
    })

@router.delete("/{schema_id}")
async def delete_schema(
    schema_id: str,
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        sid = uuid.UUID(schema_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schema ID")

    result = await db.execute(select(SchemaDef).where(SchemaDef.id == sid, SchemaDef.firm_id == firm.id))
    schema_def = result.scalar_one_or_none()
    if not schema_def:
        raise HTTPException(status_code=404, detail="Schema not found")

    await db.delete(schema_def)
    await db.commit()
    return create_response(message="Schema deleted successfully")

@router.post("/reset-defaults")
async def reset_default_schemas(
    firm: Firm = Depends(get_current_firm),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(SchemaDef.name).where(SchemaDef.firm_id == firm.id, SchemaDef.user_id == user.id))
    existing_names = set(res.scalars().all())

    added_count = 0
    for s in DEFAULT_SCHEMAS:
        if s["name"] not in existing_names:
            db.add(SchemaDef(
                firm_id=firm.id,
                user_id=user.id,
                name=s["name"],
                doc_type=s["doc_type"],
                category=s["category"],
                description=s["description"],
                fields=s["fields"]
            ))
            added_count += 1
    await db.commit()
    return create_response(message=f"Seeded {added_count} standard schemas")
