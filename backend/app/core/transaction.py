from __future__ import annotations
import time
import uuid
from typing import Any, Dict, List, Optional, Set
from backend.app.schemas.models import TransactionSchema, TransactionStatus


class Transaction:
    def __init__(
        self,
        payload: Any,
        origin: str = "Client",
        tx_id: Optional[str] = None,
        is_malicious: bool = False,
        malicious_note: Optional[str] = None,
    ):
        self.tx_id: str = tx_id or f"tx-{uuid.uuid4().hex[:8]}"
        self.payload: Any = payload
        self.submission_time: float = time.time()
        self.origin: str = origin
        self.status: TransactionStatus = TransactionStatus.PENDING
        self.replicated_to: Set[str] = set()
        self.confirmation_time: Optional[float] = None
        self.confirmation_latency_ms: Optional[float] = None
        self.term: Optional[int] = None
        self.log_index: Optional[int] = None
        self.error_message: Optional[str] = None
        self.is_malicious: bool = is_malicious
        self.malicious_note: Optional[str] = malicious_note

    def record_replication(self, validator_id: str) -> None:
        self.replicated_to.add(validator_id)
        if self.status == TransactionStatus.PENDING:
            self.status = TransactionStatus.REPLICATED

    def mark_committed(self, commit_time: Optional[float] = None, term: Optional[int] = None, log_index: Optional[int] = None) -> None:
        self.status = TransactionStatus.COMMITTED
        self.confirmation_time = commit_time or time.time()
        self.confirmation_latency_ms = round((self.confirmation_time - self.submission_time) * 1000, 2)
        if term is not None:
            self.term = term
        if log_index is not None:
            self.log_index = log_index

    def mark_rejected(self, reason: str) -> None:
        self.status = TransactionStatus.REJECTED
        self.error_message = reason

    def mark_awaiting_recovery(self, reason: str) -> None:
        self.status = TransactionStatus.AWAITING_RECOVERY
        self.error_message = reason

    def to_schema(self) -> TransactionSchema:
        return TransactionSchema(
            tx_id=self.tx_id,
            payload=self.payload,
            submission_time=self.submission_time,
            origin=self.origin,
            status=self.status,
            replicated_to=sorted(list(self.replicated_to)),
            replicated_count=len(self.replicated_to),
            confirmation_time=self.confirmation_time,
            confirmation_latency_ms=self.confirmation_latency_ms,
            term=self.term,
            log_index=self.log_index,
            error_message=self.error_message,
            is_malicious=self.is_malicious,
            malicious_note=self.malicious_note,
        )

    def to_dict(self) -> Dict[str, Any]:
        return self.to_schema().model_dump()
