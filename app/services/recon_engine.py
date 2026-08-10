import uuid
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.models import BankTransaction, LedgerEntry, ReconMatch
import string

class ReconEngine:
    def __init__(self, db: AsyncSession, client_id: str):
        self.db = db
        self.client_id = client_id

    def normalize_string(self, s: str) -> str:
        if not s:
            return ""
        s = s.lower()
        return s.translate(str.maketrans('', '', string.punctuation)).replace(" ", "")

    async def get_unmatched(self):
        bank_q = await self.db.execute(select(BankTransaction).where(
            BankTransaction.client_id == self.client_id, 
            BankTransaction.status == "unmatched"
        ))
        ledger_q = await self.db.execute(select(LedgerEntry).where(
            LedgerEntry.client_id == self.client_id, 
            LedgerEntry.status == "unmatched"
        ))
        return bank_q.scalars().all(), ledger_q.scalars().all()

    async def run_tier_1_exact(self):
        # Tier 1: Exact matches on amount and date
        bank_txns, ledger_entries = await self.get_unmatched()
        matches = []
        for bt in bank_txns:
            if bt.status != "unmatched":
                continue
            for le in ledger_entries:
                if le.status != "unmatched":
                    continue
                
                if bt.amount == le.amount and bt.date.date() == le.date.date():
                    # Check Type (dr/cr mapping depends on accounting standard, 
                    # usually bank deposit (dr to bank, cr to sales) 
                    # but let's assume simple amount matching for now)
                    if bt.type != le.type: # Actually, bank deposit might match ledger debit to bank
                        # This logic would be refined based on firm conventions.
                        pass
                    
                    matches.append((bt, le, "exact", 1.0))
                    bt.status = "matched"
                    le.status = "matched"
                    break # found one
                    
        await self._save_matches(matches)

    async def run_tier_2_fuzzy(self):
        # Tier 2: Fuzzy matches on amount (exact) but date +/- 5 days, or slight description match
        bank_txns, ledger_entries = await self.get_unmatched()
        matches = []
        for bt in bank_txns:
            if bt.status != "unmatched":
                continue
            for le in ledger_entries:
                if le.status != "unmatched":
                    continue
                
                if bt.amount == le.amount:
                    delta_days = abs((bt.date - le.date).days)
                    if delta_days <= 5:
                        matches.append((bt, le, "fuzzy", 0.9 - (delta_days * 0.05)))
                        bt.status = "matched"
                        le.status = "matched"
                        break
                
                # Check description similarity if amounts differ slightly?
                # skipping for simplicity, keeping amount exact
        await self._save_matches(matches)

    async def _save_matches(self, matches: List[Tuple[BankTransaction, LedgerEntry, str, float]]):
        for bt, le, tier, score in matches:
            match_record = ReconMatch(
                bank_txn_id=bt.id,
                ledger_entry_id=le.id,
                match_tier=tier,
                confidence_score=score
            )
            self.db.add(match_record)
        
        await self.db.commit()

    async def run_all(self):
        await self.run_tier_1_exact()
        await self.run_tier_2_fuzzy()
        # Tier 3 (One to many) is complex and skipped in this basic engine
