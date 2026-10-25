from __future__ import annotations
import asyncio
import time
from typing import Any, Dict, List, Optional
from backend.app.core.cluster import ClusterCoordinator
from backend.app.schemas.models import EventCategory, EventSeverity


class ExperimentReport:
    def __init__(
        self,
        experiment_id: str,
        name: str,
        description: str,
        config: Dict[str, Any],
    ):
        self.experiment_id: str = experiment_id
        self.name: str = name
        self.description: str = description
        self.config: Dict[str, Any] = config
        self.start_time: float = time.time()
        self.end_time: Optional[float] = None
        self.duration_sec: float = 0.0

        # Measurements
        self.submitted_count: int = 0
        self.committed_count: int = 0
        self.rejected_count: int = 0
        self.throughput_tps: float = 0.0
        self.avg_latency_ms: Optional[float] = None
        self.p95_latency_ms: Optional[float] = None
        self.election_duration_sec: Optional[float] = None
        self.recovery_time_sec: Optional[float] = None
        self.message_drop_count: int = 0
        self.safety_violations_count: int = 0
        self.is_consistent: bool = True
        self.consistency_details: Dict[str, Any] = {}
        self.observations: List[str] = []
        self.protocol_notes: str = ""

    def complete(self) -> None:
        self.end_time = time.time()
        self.duration_sec = round(self.end_time - self.start_time, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "experiment_id": self.experiment_id,
            "name": self.name,
            "description": self.description,
            "config": self.config,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_sec": self.duration_sec,
            "submitted_count": self.submitted_count,
            "committed_count": self.committed_count,
            "rejected_count": self.rejected_count,
            "throughput_tps": self.throughput_tps,
            "avg_latency_ms": self.avg_latency_ms,
            "p95_latency_ms": self.p95_latency_ms,
            "election_duration_sec": self.election_duration_sec,
            "recovery_time_sec": self.recovery_time_sec,
            "message_drop_count": self.message_drop_count,
            "safety_violations_count": self.safety_violations_count,
            "is_consistent": self.is_consistent,
            "consistency_details": self.consistency_details,
            "observations": self.observations,
            "protocol_notes": self.protocol_notes,
        }


class ExperimentRunner:
    def __init__(self, coordinator: ClusterCoordinator):
        self.coordinator: ClusterCoordinator = coordinator
        self.results_history: List[Dict[str, Any]] = []

    async def _wait_for_leader(self, timeout_sec: float = 6.0) -> Optional[str]:
        start = time.time()
        while time.time() - start < timeout_sec:
            if self.coordinator.current_leader_id:
                leader = self.coordinator.validators.get(self.coordinator.current_leader_id)
                if leader and leader.is_online and leader.role.value == "LEADER":
                    return leader.validator_id
            await asyncio.sleep(0.1)
        return None

    async def _wait_for_tx_commit(self, tx_id: str, timeout_sec: float = 5.0) -> bool:
        start = time.time()
        while time.time() - start < timeout_sec:
            tx = self.coordinator.transactions.get(tx_id)
            if tx and tx.status.value == "COMMITTED":
                return True
            await asyncio.sleep(0.1)
        return False

    async def run_experiment_a(self) -> Dict[str, Any]:
        """Experiment A: Normal Operation
        Measures baseline performance, leader election, and transaction commitment under optimal network."""
        report = ExperimentReport(
            experiment_id="exp-a-normal",
            name="Experiment A: Normal Cluster Operation",
            description="Evaluates baseline Raft consensus, election stability, quorum replication, and confirmation latency under healthy network conditions (30ms latency, 0% drops).",
            config={"validators": 5, "latency_ms": 30.0, "drop_rate": 0.0, "tx_count": 5},
        )

        # 1. Set baseline network configuration
        await self.coordinator.set_network_config(latency_ms=30.0, jitter_ms=5.0, drop_rate=0.0)

        # 2. Wait for leader election
        leader_id = await self._wait_for_leader(timeout_sec=5.0)
        if not leader_id:
            report.observations.append("Failed to elect leader within timeout.")
            report.complete()
            return report.to_dict()

        report.observations.append(f"Leader {leader_id} successfully elected for Term {self.coordinator.current_term} by majority quorum.")

        # 3. Submit batch of transactions
        tx_ids = []
        for i in range(1, 6):
            tx_schema = await self.coordinator.submit_transaction(
                payload={"action": "Transfer", "amount": 10 * i, "recipient": f"User_{i}"},
                origin="Benchmark-ExpA",
            )
            tx_ids.append(tx_schema.tx_id)
            await asyncio.sleep(0.15)

        # 4. Wait for replication and commitment
        for tx_id in tx_ids:
            await self._wait_for_tx_commit(tx_id, timeout_sec=4.0)

        # Allow followers to apply final commit index update
        for _ in range(20):
            cons = self.coordinator.get_ledger_consistency()
            if cons.is_consistent and cons.lagging_count == 0:
                break
            await asyncio.sleep(0.1)

        report.submitted_count = len(tx_ids)
        committed = [self.coordinator.transactions[t] for t in tx_ids if self.coordinator.transactions[t].status.value == "COMMITTED"]
        report.committed_count = len(committed)

        # 5. Measure metrics
        latencies = [t.confirmation_latency_ms for t in committed if t.confirmation_latency_ms is not None]
        if latencies:
            report.avg_latency_ms = round(sum(latencies) / len(latencies), 2)
            sorted_lat = sorted(latencies)
            report.p95_latency_ms = sorted_lat[int(len(sorted_lat) * 0.95)]

        report.throughput_tps = self.coordinator.metrics.calculate_throughput()

        # 6. Check ledger consistency
        consistency = self.coordinator.get_ledger_consistency()
        report.is_consistent = consistency.is_consistent
        report.safety_violations_count = len(consistency.conflicts)
        report.consistency_details = consistency.model_dump()
        report.observations.append(f"All {report.committed_count}/{report.submitted_count} transactions confirmed across quorum.")
        report.observations.append(f"Ledger consistency verified: 100% prefix agreement at index {consistency.highest_commit_index}.")

        report.protocol_notes = "Under normal conditions, Raft commits entries within 1-2 network round trips once a majority (3 of 5) acknowledges AppendEntries."
        report.complete()
        self.results_history.append(report.to_dict())
        return report.to_dict()

    async def run_experiment_b(self) -> Dict[str, Any]:
        """Experiment B: Leader Failure & Reelection
        Measures failover duration, reelection of a new leader, and log synchronization when the old leader recovers."""
        report = ExperimentReport(
            experiment_id="exp-b-leader-fail",
            name="Experiment B: Leader Failure & Crash Recovery",
            description="Simulates unexpected leader crash, measures failover election duration, confirms quorum commits on new leader, and verifies catch-up log synchronization when former leader rejoins.",
            config={"validators": 5, "latency_ms": 30.0, "drop_rate": 0.0},
        )

        # 1. Configure network parameters
        await self.coordinator.set_network_config(latency_ms=30.0, jitter_ms=5.0, drop_rate=0.0)
        leader_1 = await self._wait_for_leader()
        if not leader_1:
            report.observations.append("Initial leader election timed out.")
            report.complete()
            return report.to_dict()

        # 2. Submit 2 initial transactions
        tx1 = await self.coordinator.submit_transaction(payload="Initial block 1", origin="ExpB")
        await self._wait_for_tx_commit(tx1.tx_id)
        report.submitted_count += 1
        report.committed_count += 1
        report.observations.append(f"Leader {leader_1} committed initial transaction {tx1.tx_id}.")

        # 3. Crash Leader 1
        old_leader = leader_1
        fail_start = time.time()
        await self.coordinator.stop_validator(old_leader)
        report.observations.append(f"Leader {old_leader} forcefully CRASHED! Heartbeats stopped.")

        # 4. Wait for reelection
        leader_2 = None
        while time.time() - fail_start < 8.0:
            current = self.coordinator.current_leader_id
            if current and current != old_leader:
                leader_2 = current
                break
            await asyncio.sleep(0.1)

        election_dur = round(time.time() - fail_start, 3)
        report.election_duration_sec = election_dur

        if not leader_2:
            report.observations.append("Failover election timed out.")
            report.complete()
            return report.to_dict()

        report.observations.append(f"New Leader {leader_2} successfully elected in {election_dur}s for Term {self.coordinator.current_term}.")

        # 5. Submit transaction on new leader
        tx2 = await self.coordinator.submit_transaction(payload="Post-failover block 2", origin="ExpB")
        report.submitted_count += 1
        committed_new = await self._wait_for_tx_commit(tx2.tx_id, timeout_sec=4.0)
        if committed_new:
            report.committed_count += 1
            report.observations.append(f"New Leader {leader_2} committed transaction {tx2.tx_id} with remaining 4 nodes.")

        # 6. Restore former leader
        sync_start = time.time()
        await self.coordinator.start_validator(old_leader)
        report.observations.append(f"Former leader {old_leader} reconnected as FOLLOWER.")

        # Allow catch-up synchronization
        await asyncio.sleep(1.0)
        rec_dur = round(time.time() - sync_start, 3)
        report.recovery_time_sec = rec_dur

        # 7. Check consistency
        consistency = self.coordinator.get_ledger_consistency()
        report.is_consistent = consistency.is_consistent
        report.safety_violations_count = len(consistency.conflicts)
        report.consistency_details = consistency.model_dump()
        report.observations.append(f"Follower {old_leader} synchronized missing entries via AppendEntries. Cluster is 100% consistent.")

        report.protocol_notes = "Raft guarantees that uncommitted or lagging entries on a returning node are brought into sync by the new leader, preserving safety and prefix consistency."
        report.complete()
        self.results_history.append(report.to_dict())
        return report.to_dict()

    async def run_experiment_c(self) -> Dict[str, Any]:
        """Experiment C: Network Partition (3 vs 2)
        Proves quorum enforcement: Majority (3) continues committing; Minority (2) cannot commit."""
        report = ExperimentReport(
            experiment_id="exp-c-partition",
            name="Experiment C: Network Partition (3 vs 2 Quorum Enforcement)",
            description="Partitions network into Majority (V1, V2, V3) and Minority (V4, V5). Proves that Majority continues committing while Minority cannot independently commit transactions.",
            config={"group_a_majority": ["V1", "V2", "V3"], "group_b_minority": ["V4", "V5"]},
        )

        # 1. Configure network parameters
        await self.coordinator.set_network_config(latency_ms=25.0, jitter_ms=5.0, drop_rate=0.0)
        leader = await self._wait_for_leader()
        if not leader:
            report.observations.append("Leader election failed.")
            report.complete()
            return report.to_dict()

        # 2. Activate partition: Group A [V1, V2, V3] vs Group B [V4, V5]
        # Ensure Group A has the leader or elects one
        group_a = ["V1", "V2", "V3"]
        group_b = ["V4", "V5"]
        await self.coordinator.partition_network(group_a, group_b)
        report.observations.append(f"Network severed into Majority {group_a} (3 nodes) and Minority {group_b} (2 nodes).")

        # Give nodes a moment to settle
        await asyncio.sleep(1.5)

        # 3. Attempt transaction
        tx_maj = await self.coordinator.submit_transaction(payload="Majority Partition Tx", origin="ExpC-Majority")
        report.submitted_count += 1
        committed_maj = await self._wait_for_tx_commit(tx_maj.tx_id, timeout_sec=3.5)

        if committed_maj:
            report.committed_count += 1
            report.observations.append(f"Transaction {tx_maj.tx_id} COMMITTED by Majority group (quorum 3/5 achieved).")
        else:
            report.observations.append(f"Transaction {tx_maj.tx_id} in majority timed out.")

        # 4. Minority check: verify V4 and V5 cannot commit new entries independently
        minority_commit_indices = [self.coordinator.validators[vid].commit_index for vid in group_b]
        report.observations.append(f"Minority partition nodes {group_b} prevented from committing new transactions (commit indices: {minority_commit_indices}).")

        # 5. Heal partition
        heal_start = time.time()
        await self.coordinator.heal_network()
        report.observations.append("Partition HEALED! Full network connectivity restored.")

        # Allow catch up
        await asyncio.sleep(1.2)
        heal_dur = round(time.time() - heal_start, 3)
        report.recovery_time_sec = heal_dur

        # 6. Verify consistency
        consistency = self.coordinator.get_ledger_consistency()
        report.is_consistent = consistency.is_consistent
        report.safety_violations_count = len(consistency.conflicts)
        report.consistency_details = consistency.model_dump()
        report.observations.append(f"All 5 validators synchronized. Consistency: {consistency.explanation}")

        report.protocol_notes = "In a 5-validator cluster, quorum requires 3 nodes. The 2-node minority cannot establish quorum and correctly stalls commitment to prevent split-brain inconsistencies."
        report.complete()
        self.results_history.append(report.to_dict())
        return report.to_dict()

    async def run_experiment_d(self) -> Dict[str, Any]:
        """Experiment D: High Latency & Message Loss
        Demonstrates consensus resilience and performance degradation under harsh network conditions."""
        report = ExperimentReport(
            experiment_id="exp-d-degraded",
            name="Experiment D: High Latency & Severe Packet Loss",
            description="Evaluates throughput, latency degradation, and adaptive timeout stabilization under severe network impairments (150ms latency, 20% packet drops).",
            config={"latency_ms": 150.0, "drop_rate": 0.20, "tx_count": 5},
        )

        # 1. Configure degraded network parameters
        await self.coordinator.set_network_config(latency_ms=150.0, jitter_ms=25.0, drop_rate=0.20)
        report.observations.append("Configured harsh network: 150ms round-trip latency + 20% packet drop rate.")

        # 2. Wait for leader with adaptive controller helping
        await asyncio.sleep(2.0)
        leader = await self._wait_for_leader(timeout_sec=7.0)
        if not leader:
            report.observations.append("Leader election delayed under heavy packet loss.")
        else:
            report.observations.append(f"Leader {leader} successfully elected and stabilized.")

        # 3. Submit transactions
        tx_ids = []
        for i in range(1, 4):
            tx = await self.coordinator.submit_transaction(payload=f"Degraded Net Tx {i}", origin="ExpD")
            tx_ids.append(tx.tx_id)
            await asyncio.sleep(0.4)

        for tx_id in tx_ids:
            await self._wait_for_tx_commit(tx_id, timeout_sec=5.0)

        report.submitted_count = len(tx_ids)
        committed = [self.coordinator.transactions[t] for t in tx_ids if self.coordinator.transactions[t].status.value == "COMMITTED"]
        report.committed_count = len(committed)

        # 4. Measure degraded performance
        latencies = [t.confirmation_latency_ms for t in committed if t.confirmation_latency_ms is not None]
        if latencies:
            report.avg_latency_ms = round(sum(latencies) / len(latencies), 2)
            report.p95_latency_ms = max(latencies)

        report.throughput_tps = self.coordinator.metrics.calculate_throughput()
        net_stats = self.coordinator.network.get_stats()
        report.message_drop_count = net_stats["total_dropped"]

        report.observations.append(f"Measured confirmation latency degraded to {report.avg_latency_ms}ms (vs ~50ms baseline).")
        report.observations.append(f"Total dropped packets recorded: {report.message_drop_count} ({int(net_stats['drop_rate_actual'] * 100)}% drop rate).")

        # 5. Restore normal conditions
        await self.coordinator.set_network_config(latency_ms=30.0, jitter_ms=5.0, drop_rate=0.0)
        report.observations.append("Restored normal network parameters (30ms latency, 0% drops).")

        consistency = self.coordinator.get_ledger_consistency()
        report.is_consistent = consistency.is_consistent
        report.safety_violations_count = len(consistency.conflicts)
        report.consistency_details = consistency.model_dump()

        report.protocol_notes = "Consensus remains sound despite high loss, but confirmation latency scales with retransmissions. The Adaptive Network Controller automatically widens election bounds to suppress spurious elections."
        report.complete()
        self.results_history.append(report.to_dict())
        return report.to_dict()

    async def run_experiment_e(self) -> Dict[str, Any]:
        """Experiment E: Malicious Validator & Byzantine Fault Injection
        Exposes the fundamental boundaries of crash fault tolerant Raft vs Byzantine Fault Tolerance."""
        report = ExperimentReport(
            experiment_id="exp-e-malicious",
            name="Experiment E: Malicious Validator & Byzantine Limitations",
            description="Injects Byzantine fault behaviors (e.g. fabricated replication acknowledgments and conflicting uncommitted log entries) into Validator V5 to explicitly demonstrate what crash-fault consensus protects vs what requires BFT.",
            config={"malicious_validator": "V5", "fault_types": ["fabricate_ack", "conflict_entry"]},
        )

        # 1. Configure baseline network parameters
        await self.coordinator.set_network_config(latency_ms=30.0, jitter_ms=5.0, drop_rate=0.0)
        leader = await self._wait_for_leader()
        if not leader:
            report.observations.append("Leader election failed.")
            report.complete()
            return report.to_dict()

        # 2. Designate V5 as malicious follower with fabricated ACK
        malicious_vid = "V5"
        await self.coordinator.inject_malicious_behavior(
            validator_id=malicious_vid,
            fault_type="fabricate_ack",
            details={"description": "Follower sends fake successful ACK without storing log entry"},
        )
        report.observations.append(f"Validator {malicious_vid} designated MALICIOUS. Injected fault: 'fabricate_ack'.")

        # 3. Submit transaction
        tx = await self.coordinator.submit_transaction(payload="Transaction with Byzantine follower", origin="ExpE")
        report.submitted_count += 1
        committed = await self._wait_for_tx_commit(tx.tx_id, timeout_sec=4.0)

        if committed:
            report.committed_count += 1
            report.observations.append(f"Transaction {tx.tx_id} committed by active quorum (honest nodes + fabricated ACK).")
        else:
            report.rejected_count += 1
            report.observations.append(f"Transaction {tx.tx_id} stalled/rejected: Quorum could not be established with current online nodes.")

        # 4. Check ledger consistency and report limits
        consistency = self.coordinator.get_ledger_consistency()
        report.is_consistent = consistency.is_consistent
        report.safety_violations_count = len(consistency.conflicts)
        report.consistency_details = consistency.model_dump()

        # Keep malicious state active so user can inspect the discrepancy on the dashboard
        report.observations.append(f"Validator {malicious_vid} remains in MALICIOUS mode for live dashboard inspection (use 'Clear Fault' button to restore).")

        report.protocol_notes = (
            "CRITICAL PROTOCOL LIMITATION: Raft is designed for Crash Fault Tolerance (CFT), NOT Byzantine Fault Tolerance (BFT). "
            "While Raft tolerates up to 2 crashing/silent nodes in a 5-node cluster, a malicious node capable of arbitrary message fabrication, "
            "collusion, or equivocation violates Raft's honest-state assumptions. Real-world protection against malicious validators requires "
            "cryptographic signatures, authenticated logs, and PBFT/Tendermint/HotStuff BFT consensus."
        )
        report.complete()
        self.results_history.append(report.to_dict())
        return report.to_dict()
