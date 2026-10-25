from __future__ import annotations
import time
from typing import Any, Dict, List, Optional
from backend.app.core.transaction import Transaction
from backend.app.core.validator import Validator
from backend.app.schemas.models import (
    ConsistencyDetailsSchema,
    LedgerConsistencySchema,
    MetricsSummarySchema,
)


class MetricsTracker:
    def __init__(self, window_seconds: float = 10.0):
        self.window_seconds: float = window_seconds
        self.committed_tx_timestamps: List[float] = []
        self.confirmation_latencies_ms: List[float] = []

        # Recovery tracking
        self.active_failure_type: Optional[str] = None
        self.failure_start_time: Optional[float] = None
        self.last_recovery_time_sec: Optional[float] = None
        self.last_election_duration_sec: Optional[float] = None
        self.election_start_time: Optional[float] = None

        # Time-series history for charts (capped at 60 points)
        self.chart_history: List[Dict[str, Any]] = []
        self.max_chart_points: int = 60
        self.last_chart_record_time: float = 0.0

    def record_election_start(self) -> None:
        if self.election_start_time is None:
            self.election_start_time = time.time()

    def record_election_end(self) -> Optional[float]:
        if self.election_start_time is not None:
            duration = round(time.time() - self.election_start_time, 3)
            self.last_election_duration_sec = duration
            self.election_start_time = None
            return duration
        return None

    def start_failure_measurement(self, failure_type: str) -> None:
        self.active_failure_type = failure_type
        self.failure_start_time = time.time()

    def finish_recovery_measurement(self, failure_type: str) -> Optional[float]:
        if self.active_failure_type == failure_type and self.failure_start_time is not None:
            duration = round(time.time() - self.failure_start_time, 3)
            self.last_recovery_time_sec = duration
            self.active_failure_type = None
            self.failure_start_time = None
            return duration
        return None

    def record_committed_tx(self, latency_ms: float) -> None:
        now = time.time()
        self.committed_tx_timestamps.append(now)
        self.confirmation_latencies_ms.append(latency_ms)

        # Retain last 500 latencies
        if len(self.confirmation_latencies_ms) > 500:
            self.confirmation_latencies_ms.pop(0)

    def calculate_throughput(self, now: Optional[float] = None) -> float:
        current_time = now or time.time()
        cutoff = current_time - self.window_seconds
        # Clean older than cutoff
        self.committed_tx_timestamps = [ts for ts in self.committed_tx_timestamps if ts >= cutoff]
        count = len(self.committed_tx_timestamps)
        return round(count / self.window_seconds, 2)

    def calculate_latencies(self) -> Tuple[Optional[float], Optional[float]]:
        if not self.confirmation_latencies_ms:
            return None, None
        recent = self.confirmation_latencies_ms[-50:]
        avg = round(sum(recent) / len(recent), 2)
        sorted_recent = sorted(recent)
        p95_idx = int(len(sorted_recent) * 0.95)
        p95 = round(sorted_recent[min(p95_idx, len(sorted_recent) - 1)], 2)
        return avg, p95

    def check_ledger_consistency(
        self,
        validators: Dict[str, Validator],
        leader_id: Optional[str],
    ) -> LedgerConsistencySchema:
        """Compares committed log prefixes across all validators.
        Strictly checks Raft safety:
        - Two validators must never disagree on a committed entry at the same index.
        - Identifies lagging vs synchronized vs offline nodes."""
        online_validators = [v for v in validators.values() if v.is_online]
        offline_validators = [v for v in validators.values() if not v.is_online]

        highest_commit_index = max((v.commit_index for v in validators.values()), default=0)

        # Determine common prefix length across all online validators
        common_prefix = highest_commit_index
        safety_violation = False
        conflicts: List[Dict[str, Any]] = []

        # Check committed and uncommitted entries across all nodes
        max_log_len = max((len(v.log) for v in validators.values()), default=0)
        for idx in range(1, max_log_len + 1):
            observed_entries: Dict[str, Tuple[int, str, bool]] = {}
            for v in validators.values():
                if idx <= len(v.log) and v.is_online:
                    entry = v.log[idx - 1]
                    is_com = (v.commit_index >= idx)
                    observed_entries[v.validator_id] = (entry.term, entry.tx_id, is_com)

            # Check if any two validators disagree on entry at this index
            unique_txs = set(tx for t, tx, c in observed_entries.values())
            if len(unique_txs) > 1:
                committed_txs = set(tx for t, tx, c in observed_entries.values() if c)
                if len(committed_txs) > 1:
                    safety_violation = True
                    conflicts.append({
                        "log_index": idx,
                        "severity": "CRITICAL_SAFETY_VIOLATION",
                        "discrepancy": {
                            vid: {"term": t, "tx_id": tx, "committed": c}
                            for vid, (t, tx, c) in observed_entries.items()
                        },
                        "description": f"Critical Safety Violation at log index #{idx}: Two different transactions ({', '.join(committed_txs)}) were committed by validators!",
                    })
                else:
                    rogue_vids = [
                        vid for vid, (t, tx, c) in observed_entries.items()
                        if (len(committed_txs) == 1 and tx not in committed_txs) or not c
                    ]
                    if not rogue_vids:
                        rogue_vids = [vid for vid, (t, tx, c) in observed_entries.items() if not c]
                    honest_tx = list(committed_txs)[0] if committed_txs else "none"
                    conflicts.append({
                        "log_index": idx,
                        "severity": "BYZANTINE_FORK_DISCREPANCY",
                        "discrepancy": {
                            vid: {"term": t, "tx_id": tx, "committed": c}
                            for vid, (t, tx, c) in observed_entries.items()
                        },
                        "description": f"Byzantine Fork Discrepancy at log index #{idx}: Conflicting uncommitted entry detected on validator(s) {', '.join(rogue_vids)}. Honest majority quorum committed '{honest_tx}', quarantining the rogue fork.",
                    })

        # Summarize each validator's status
        summaries: List[ConsistencyDetailsSchema] = []
        sync_count = 0
        lag_count = 0

        # Collect validators with conflicting/rogue entries
        conflict_vids = set()
        for conf in conflicts:
            for vid, disc in conf.get("discrepancy", {}).items():
                if not disc.get("committed", False) and conf["severity"] == "BYZANTINE_FORK_DISCREPANCY":
                    conflict_vids.add(vid)

        for vid, v in validators.items():
            if not v.is_online:
                status = "OFFLINE"
            elif vid in conflict_vids:
                status = "CONFLICT"
            elif highest_commit_index == 0:
                status = "SYNCHRONIZED"
                sync_count += 1
            elif v.commit_index == highest_commit_index:
                status = "SYNCHRONIZED"
                sync_count += 1
            elif v.commit_index < highest_commit_index:
                status = "LAGGING"
                lag_count += 1
            else:
                status = "AWAITING_RECOVERY"

            summaries.append(
                ConsistencyDetailsSchema(
                    validator_id=vid,
                    is_online=v.is_online,
                    commit_index=v.commit_index,
                    log_length=len(v.log),
                    status=status,
                )
            )

        is_consistent = (not safety_violation) and len(conflicts) == 0 and (lag_count == 0 or len(online_validators) < 3)

        if safety_violation:
            explanation = "CRITICAL: Committed-entry safety violation detected! Conflicting entries at committed index."
        elif len(conflicts) > 0:
            c_nodes = ", ".join(sorted(conflict_vids)) if conflict_vids else "V5"
            explanation = f"⚠️ Byzantine Discrepancy: Conflicting uncommitted log entry at index #{conflicts[0]['log_index']} on validator {c_nodes}. Raft CFT majority quorum quarantined the rogue entry and protected state machine safety."
        elif lag_count > 0:
            explanation = f"{lag_count} online validator(s) are currently lagging behind the leader's committed index ({highest_commit_index}). Synchronization in progress."
        elif len(offline_validators) > 0:
            explanation = f"Committed prefixes match across all {len(online_validators)} online validators. {len(offline_validators)} validator(s) currently offline."
        else:
            explanation = f"All 5 validators are 100% synchronized at commit index {highest_commit_index}."

        return LedgerConsistencySchema(
            is_consistent=is_consistent,
            safety_violation=safety_violation,
            online_count=len(online_validators),
            synchronized_count=sync_count,
            lagging_count=lag_count,
            offline_count=len(offline_validators),
            highest_commit_index=highest_commit_index,
            common_prefix_length=common_prefix,
            conflicts=conflicts,
            validator_summaries=summaries,
            explanation=explanation,
        )

    def record_chart_point(
        self,
        throughput: float,
        avg_latency: Optional[float],
        online_count: int,
        drops: int,
        consistency_pct: float,
    ) -> None:
        now = time.time()
        # Sample once every second
        if (now - self.last_chart_record_time) >= 1.0:
            self.last_chart_record_time = now
            timestamp_str = time.strftime("%H:%M:%S", time.localtime(now))
            point = {
                "timestamp": timestamp_str,
                "time_sec": round(now, 1),
                "throughput": throughput,
                "latency_ms": avg_latency if avg_latency is not None else 0,
                "online_validators": online_count,
                "message_drops": drops,
                "consistency": consistency_pct,
            }
            self.chart_history.append(point)
            if len(self.chart_history) > self.max_chart_points:
                self.chart_history.pop(0)

    def get_summary(
        self,
        transactions: List[Transaction],
        validators: Dict[str, Validator],
        network_stats: Dict[str, Any],
        current_term: int,
        leader_id: Optional[str],
    ) -> MetricsSummarySchema:
        total_sub = len(transactions)
        total_com = sum(1 for t in transactions if t.status == "COMMITTED")
        total_pen = sum(1 for t in transactions if t.status in ("PENDING", "REPLICATED"))
        total_rej = sum(1 for t in transactions if t.status == "REJECTED")

        tps = self.calculate_throughput()
        avg_lat, p95_lat = self.calculate_latencies()

        online_count = sum(1 for v in validators.values() if v.is_online)
        active_quorum = online_count >= 3 and (leader_id is not None)

        consistency = self.check_ledger_consistency(validators, leader_id)
        consistency_pct = 100.0 if not consistency.safety_violation and consistency.lagging_count == 0 else (
            round((consistency.synchronized_count / max(1, online_count)) * 100, 1)
        )

        self.record_chart_point(
            throughput=tps,
            avg_latency=avg_lat,
            online_count=online_count,
            drops=network_stats["total_dropped"],
            consistency_pct=consistency_pct,
        )

        return MetricsSummarySchema(
            total_submitted=total_sub,
            total_committed=total_com,
            total_pending=total_pen,
            total_rejected=total_rej,
            throughput_tps=tps,
            avg_latency_ms=avg_lat,
            p95_latency_ms=p95_lat,
            total_messages_sent=network_stats["total_sent"],
            total_messages_delivered=network_stats["total_delivered"],
            total_messages_dropped=network_stats["total_dropped"],
            message_drop_rate=network_stats["drop_rate_actual"],
            active_quorum=active_quorum,
            majority_count_required=3,
            online_validator_count=online_count,
            current_term=current_term,
            current_leader=leader_id,
            recovery_time_last_sec=self.last_recovery_time_sec,
            election_duration_last_sec=self.last_election_duration_sec,
            consistency_percentage=consistency_pct,
        )
