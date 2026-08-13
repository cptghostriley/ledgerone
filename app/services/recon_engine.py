import logging
from collections import defaultdict
from datetime import date
from difflib import SequenceMatcher
from itertools import combinations
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import BankTransaction, LedgerEntry, ReconMatch

logger = logging.getLogger(__name__)


class ReconEngine:
    def __init__(self, db: AsyncSession, client_id: str):
        self.db = db
        self.client_id = client_id
        self._matched_bank_ids: set[UUID] = set()
        self._matched_ledger_ids: set[UUID] = set()

    def _normalize(self, value: str | None) -> str:
        if not value:
            return ""
        return "".join(ch.lower() for ch in value if ch.isalnum() or ch.isspace()).strip()

    def _description_score(self, left: str | None, right: str | None) -> float:
        return SequenceMatcher(None, self._normalize(left), self._normalize(right)).ratio()

    def _is_available(self, bank_txn: BankTransaction, ledger_entry: LedgerEntry) -> bool:
        return bank_txn.id not in self._matched_bank_ids and ledger_entry.id not in self._matched_ledger_ids

    async def get_unmatched(self) -> tuple[list[BankTransaction], list[LedgerEntry]]:
        bank_q = await self.db.execute(
            select(BankTransaction).where(
                BankTransaction.client_id == self.client_id,
                BankTransaction.status == "unmatched",
            ).order_by(BankTransaction.date)
        )
        ledger_q = await self.db.execute(
            select(LedgerEntry).where(
                LedgerEntry.client_id == self.client_id,
                LedgerEntry.status == "unmatched",
            ).order_by(LedgerEntry.date)
        )
        return bank_q.scalars().all(), ledger_q.scalars().all()

    async def _save_match(
        self,
        bank_txn: BankTransaction,
        ledger_entry: LedgerEntry,
        tier: str,
        confidence_score: float,
        created_by: UUID | None = None,
        match_meta: dict[str, Any] | None = None,
    ) -> None:
        bank_txn.status = "matched"
        ledger_entry.status = "matched"
        self._matched_bank_ids.add(bank_txn.id)
        self._matched_ledger_ids.add(ledger_entry.id)
        self.db.add(
            ReconMatch(
                bank_txn_id=bank_txn.id,
                ledger_entry_id=ledger_entry.id,
                match_tier=tier,
                confidence_score=confidence_score,
                created_by=created_by,
                match_meta=match_meta or {},
            )
        )

    async def _save_group_match(
        self,
        bank_txn: BankTransaction,
        ledger_entries: list[LedgerEntry],
        confidence_score: float,
        created_by: UUID | None = None,
        tier: str = "multi",
        match_meta: dict[str, Any] | None = None,
    ) -> None:
        bank_txn.status = "matched"
        self._matched_bank_ids.add(bank_txn.id)
        meta = match_meta or {}
        meta.setdefault("ledger_entry_ids", [str(entry.id) for entry in ledger_entries])
        meta.setdefault("ledger_total", round(sum(float(entry.amount) for entry in ledger_entries), 2))
        meta.setdefault("source_count", len(ledger_entries))

        for entry in ledger_entries:
            entry.status = "matched"
            self._matched_ledger_ids.add(entry.id)

        first_ledger = ledger_entries[0]
        self.db.add(
            ReconMatch(
                bank_txn_id=bank_txn.id,
                ledger_entry_id=first_ledger.id,
                match_tier=tier,
                confidence_score=confidence_score,
                created_by=created_by,
                match_meta=meta,
            )
        )

    async def run_tier_1_exact(self) -> int:
        bank_txns, ledger_entries = await self.get_unmatched()
        matches = 0
        for bank_txn in bank_txns:
            if bank_txn.id in self._matched_bank_ids:
                continue
            for ledger_entry in ledger_entries:
                if not self._is_available(bank_txn, ledger_entry):
                    continue
                if round(float(bank_txn.amount), 2) == round(float(ledger_entry.amount), 2) and bank_txn.date.date() == ledger_entry.date.date():
                    await self._save_match(
                        bank_txn,
                        ledger_entry,
                        tier="exact",
                        confidence_score=1.0,
                        match_meta={
                            "reason": "exact amount and date match",
                            "day_distance": 0,
                            "amount_gap": 0.0,
                        },
                    )
                    matches += 1
                    break
        await self.db.commit()
        return matches

    async def run_tier_2_fuzzy(self) -> int:
        bank_txns, ledger_entries = await self.get_unmatched()
        matches = 0
        for bank_txn in bank_txns:
            if bank_txn.id in self._matched_bank_ids:
                continue

            scored_candidates: list[tuple[float, LedgerEntry, dict[str, Any]]] = []
            for ledger_entry in ledger_entries:
                if not self._is_available(bank_txn, ledger_entry):
                    continue
                amount_gap = abs(float(bank_txn.amount) - float(ledger_entry.amount))
                day_distance = abs((bank_txn.date.date() - ledger_entry.date.date()).days)
                description_score = self._description_score(bank_txn.description, ledger_entry.description)
                amount_score = max(0.0, 1.0 - min(amount_gap / max(abs(float(bank_txn.amount)), 1.0), 1.0))
                time_score = max(0.0, 1.0 - (day_distance / 6.0))
                confidence = (amount_score * 0.45) + (time_score * 0.30) + (description_score * 0.25)
                if confidence >= 0.72 and (amount_gap <= 1.0 or day_distance <= 5 or description_score >= 0.78):
                    scored_candidates.append((confidence, ledger_entry, {
                        "reason": "fuzzy match",
                        "day_distance": day_distance,
                        "amount_gap": round(amount_gap, 2),
                        "description_score": round(description_score, 3),
                    }))

            scored_candidates.sort(key=lambda item: item[0], reverse=True)
            if scored_candidates:
                confidence, ledger_entry, meta = scored_candidates[0]
                await self._save_match(bank_txn, ledger_entry, tier="fuzzy", confidence_score=round(confidence, 3), match_meta=meta)
                matches += 1

        await self.db.commit()
        return matches

    async def run_tier_3_multi(self) -> int:
        bank_txns, ledger_entries = await self.get_unmatched()
        matches = 0

        ledger_pool = [entry for entry in ledger_entries if entry.id not in self._matched_ledger_ids]
        if not ledger_pool:
            return 0

        for bank_txn in bank_txns:
            if bank_txn.id in self._matched_bank_ids:
                continue

            bank_amount = round(float(bank_txn.amount), 2)
            candidate_pool = [entry for entry in ledger_pool if entry.id not in self._matched_ledger_ids]
            candidate_pool = [entry for entry in candidate_pool if abs((bank_txn.date.date() - entry.date.date()).days) <= 10]

            for size in (2, 3):
                if len(candidate_pool) < size:
                    continue
                for combo in combinations(candidate_pool, size):
                    combo_total = round(sum(float(entry.amount) for entry in combo), 2)
                    if abs(combo_total - bank_amount) > max(5.0, bank_amount * 0.01):
                        continue
                    average_score = sum(self._description_score(bank_txn.description, entry.description) for entry in combo) / len(combo)
                    if average_score < 0.45:
                        continue
                    await self._save_group_match(
                        bank_txn,
                        list(combo),
                        confidence_score=round(0.6 + (average_score * 0.25), 3),
                        match_meta={
                            "reason": "subset sum recon match",
                            "bank_amount": bank_amount,
                            "ledger_total": combo_total,
                            "description_score": round(average_score, 3),
                        },
                    )
                    matches += 1
                    break
                if bank_txn.id in self._matched_bank_ids:
                    break

        await self.db.commit()
        return matches

    async def run_all(self) -> dict[str, int]:
        exact = await self.run_tier_1_exact()
        fuzzy = await self.run_tier_2_fuzzy()
        multi = await self.run_tier_3_multi()
        return {
            "exact_matches": exact,
            "fuzzy_matches": fuzzy,
            "multi_matches": multi,
        }
