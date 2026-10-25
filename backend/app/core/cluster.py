from __future__ import annotations
import asyncio
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Set
from backend.app.core.adaptive import AdaptiveDecision, AdaptiveNetworkController
from backend.app.core.metrics import MetricsTracker
from backend.app.core.network import MessageType, NetworkMessage, NetworkSimulator
from backend.app.core.transaction import Transaction
from backend.app.core.validator import Validator, LogEntry
from backend.app.schemas.models import (
    ClusterStatusSchema,
    EventCategory,
    EventSeverity,
    LedgerConsistencySchema,
    NetworkConfigSchema,
    SimulationEventSchema,
    TransactionSchema,
    TransactionStatus,
    ValidatorRole,
    ValidatorStateSchema,
)


class ClusterCoordinator:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.validator_ids: List[str] = ["V1", "V2", "V3", "V4", "V5"]

        # Core components
        self.network = NetworkSimulator(
            config=NetworkConfigSchema(latency_ms=30.0, jitter_ms=10.0, drop_rate=0.0)
        )
        self.metrics = MetricsTracker(window_seconds=10.0)
        self.adaptive = AdaptiveNetworkController(on_decision_callback=self._on_adaptive_decision)

        # Validators
        self.validators: Dict[str, Validator] = {}
        self._init_validators()

        # Transactions
        self.transactions: Dict[str, Transaction] = {}
        self.tx_order: List[str] = []

        # Events
        self.events: List[SimulationEventSchema] = []
        self.max_events: int = 500

        # Background loop control
        self.running: bool = False
        self.loop_task: Optional[asyncio.Task] = None
        self.broadcast_callbacks: List[Callable[[Dict[str, Any]], Any]] = []

        # Current elected leader tracking
        self.current_leader_id: Optional[str] = None
        self.current_term: int = 0

    def _init_validators(self) -> None:
        self.validators.clear()
        for vid in self.validator_ids:
            val = Validator(
                validator_id=vid,
                peers=self.validator_ids,
                base_election_timeout_min=self.adaptive.current_election_min,
                base_election_timeout_max=self.adaptive.current_election_max,
                heartbeat_interval=self.adaptive.current_heartbeat_interval,
            )
            self.validators[vid] = val

    def register_broadcast_callback(self, cb: Callable[[Dict[str, Any]], Any]) -> None:
        self.broadcast_callbacks.append(cb)

    def record_event(
        self,
        severity: EventSeverity,
        category: EventCategory,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> SimulationEventSchema:
        ev = SimulationEventSchema(
            event_id=f"ev-{uuid.uuid4().hex[:8]}",
            timestamp=time.time(),
            severity=severity,
            category=category,
            message=message,
            details=details,
        )
        self.events.append(ev)
        if len(self.events) > self.max_events:
            self.events.pop(0)
        return ev

    def _on_adaptive_decision(self, decision: AdaptiveDecision) -> None:
        # Apply updated timeouts to all validators
        for v in self.validators.values():
            v.update_timeout_bounds(
                min_timeout=decision.new_config["election_min"],
                max_timeout=decision.new_config["election_max"],
                heartbeat_interval=decision.new_config["heartbeat_interval"],
            )

        self.record_event(
            severity=EventSeverity.WARNING if decision.classification != "HEALTHY" else EventSeverity.INFO,
            category=EventCategory.ADAPTIVE,
            message=f"Adaptive Network Controller: {decision.classification} - {decision.reason}",
            details=decision.to_dict(),
        )

    async def start(self) -> None:
        self.running = True
        self.record_event(
            severity=EventSeverity.INFO,
            category=EventCategory.SYSTEM,
            message="Blockchain Consensus Simulator initialized with 5 validators (V1-V5).",
        )
        self.loop_task = asyncio.create_task(self._simulation_loop())

    async def stop(self) -> None:
        self.running = False
        if self.loop_task:
            self.loop_task.cancel()
            try:
                await self.loop_task
            except asyncio.CancelledError:
                pass

    async def _simulation_loop(self) -> None:
        """High-resolution simulation tick loop (30ms frequency)."""
        while self.running:
            try:
                async with self.lock:
                    self._tick()
                await self._notify_subscribers()
            except Exception as e:
                # Log exception internally to prevent crash
                print(f"Error in simulation tick: {e}")
            await asyncio.sleep(0.03)

    def _tick(self) -> None:
        now = time.time()

        # 1. Deliver ready network messages
        ready_messages = self.network.pull_ready_messages(now=now)
        for msg in ready_messages:
            self._process_network_message(msg)

        # 2. Check Leader Heartbeats & Replications
        for v in list(self.validators.values()):
            if v.is_online and v.role == ValidatorRole.LEADER:
                self.current_leader_id = v.validator_id
                self.current_term = v.current_term
                if v.should_send_heartbeat(now=now):
                    v.last_heartbeat_sent_time = now
                    self._broadcast_append_entries(v)

        # 3. Check Election Timeouts for Followers and Candidates
        for v in list(self.validators.values()):
            if v.is_online and v.role != ValidatorRole.LEADER:
                if v.is_election_timeout_expired(now=now):
                    self._trigger_election(v)

        # 4. Check Quorum Health
        online_count = sum(1 for v in self.validators.values() if v.is_online)
        has_quorum = online_count >= 3 and (self.current_leader_id is not None)

        # 5. Evaluate Adaptive Policies
        is_partitioned = self.network.partitions is not None
        drop_rate = self.network.config.drop_rate
        latency = self.network.config.latency_ms
        leader_alive = (
            self.current_leader_id is not None
            and self.validators.get(self.current_leader_id) is not None
            and self.validators[self.current_leader_id].is_online
        )

        self.adaptive.evaluate(
            network_latency_ms=latency,
            network_drop_rate=drop_rate,
            is_partitioned=is_partitioned,
            online_validators=online_count,
            leader_alive=leader_alive,
        )

    def _trigger_election(self, candidate: Validator) -> None:
        if candidate.is_malicious:
            return  # Byzantine faulty nodes do not initiate leader elections
        self.metrics.record_election_start()
        prev_term = candidate.current_term
        new_term, payload = candidate.start_election()

        self.record_event(
            severity=EventSeverity.WARNING,
            category=EventCategory.ELECTION,
            message=f"{candidate.validator_id} election timeout elapsed. Starting election for Term {new_term}.",
            details={"validator_id": candidate.validator_id, "prev_term": prev_term, "new_term": new_term},
        )

        # Broadcast RequestVote to all peers
        for peer_id in candidate.peers:
            peer = self.validators.get(peer_id)
            is_peer_online = peer.is_online if peer else False
            msg = self.network.send_message(
                source=candidate.validator_id,
                destination=peer_id,
                msg_type=MessageType.REQUEST_VOTE,
                term=new_term,
                data=payload,
                is_source_online=candidate.is_online,
                is_dest_online=is_peer_online,
            )
            candidate.messages_sent += 1
            if msg and msg.dropped:
                self.record_event(
                    severity=EventSeverity.INFO,
                    category=EventCategory.NETWORK,
                    message=f"RequestVote message {candidate.validator_id} -> {peer_id} dropped: {msg.drop_reason}",
                )

    def _broadcast_append_entries(self, leader: Validator) -> None:
        for peer_id in leader.peers:
            peer = self.validators.get(peer_id)
            is_peer_online = peer.is_online if peer else False
            payload = leader.create_append_entries(peer_id)

            msg_type = MessageType.APPEND_ENTRIES if payload["entries"] else MessageType.HEARTBEAT
            msg = self.network.send_message(
                source=leader.validator_id,
                destination=peer_id,
                msg_type=msg_type,
                term=leader.current_term,
                data=payload,
                is_source_online=leader.is_online,
                is_dest_online=is_peer_online,
            )
            leader.messages_sent += 1
            if msg and msg.dropped:
                leader.messages_dropped += 1

    def _process_network_message(self, msg: NetworkMessage) -> None:
        receiver = self.validators.get(msg.destination)
        if not receiver or not receiver.is_online:
            return

        if msg.msg_type == MessageType.REQUEST_VOTE:
            term, vote_granted, reason = receiver.handle_request_vote(
                candidate_term=msg.term,
                candidate_id=msg.source,
                last_log_index=msg.data.get("last_log_index", 0),
                last_log_term=msg.data.get("last_log_term", 0),
            )
            # Send vote response back to candidate
            candidate = self.validators.get(msg.source)
            is_cand_online = candidate.is_online if candidate else False
            resp_msg = self.network.send_message(
                source=receiver.validator_id,
                destination=msg.source,
                msg_type=MessageType.REQUEST_VOTE_RESPONSE,
                term=term,
                data={"voter_id": receiver.validator_id, "vote_granted": vote_granted, "reason": reason},
                is_source_online=receiver.is_online,
                is_dest_online=is_cand_online,
            )
            receiver.messages_sent += 1

        elif msg.msg_type == MessageType.REQUEST_VOTE_RESPONSE:
            voter_id = msg.data.get("voter_id", msg.source)
            vote_granted = msg.data.get("vote_granted", False)
            became_leader = receiver.handle_request_vote_response(
                voter_id=voter_id,
                term=msg.term,
                vote_granted=vote_granted,
            )
            if became_leader:
                duration = self.metrics.record_election_end()
                self.current_leader_id = receiver.validator_id
                self.current_term = receiver.current_term
                self.record_event(
                    severity=EventSeverity.SUCCESS,
                    category=EventCategory.ELECTION,
                    message=f"Validator {receiver.validator_id} received majority votes ({len(receiver.votes_received)}/5). Elected LEADER for Term {receiver.current_term}!",
                    details={
                        "leader_id": receiver.validator_id,
                        "term": receiver.current_term,
                        "duration_sec": duration,
                        "votes": list(receiver.votes_received),
                    },
                )
                # Send immediate heartbeat
                self._broadcast_append_entries(receiver)

        elif msg.msg_type in (MessageType.HEARTBEAT, MessageType.APPEND_ENTRIES):
            term, success, match_index, reason = receiver.handle_append_entries(
                leader_term=msg.term,
                leader_id=msg.data.get("leader_id", msg.source),
                prev_log_index=msg.data.get("prev_log_index", 0),
                prev_log_term=msg.data.get("prev_log_term", 0),
                entries=msg.data.get("entries", []),
                leader_commit=msg.data.get("leader_commit", 0),
            )
            # Track transaction replications on follower
            if success and msg.data.get("entries"):
                for entry_dict in msg.data["entries"]:
                    tx_id = entry_dict["tx_id"]
                    if tx_id in self.transactions:
                        self.transactions[tx_id].record_replication(receiver.validator_id)
            elif not success and receiver.is_malicious and msg.data.get("entries"):
                self.record_event(
                    severity=EventSeverity.FAULT,
                    category=EventCategory.MALICIOUS,
                    message=f"Malicious validator {receiver.validator_id} ({receiver.malicious_type}): {reason}",
                    details={"validator_id": receiver.validator_id, "fault_type": receiver.malicious_type, "reason": reason},
                )

            # Reply with AppendEntriesResponse
            leader = self.validators.get(msg.source)
            is_leader_online = leader.is_online if leader else False
            self.network.send_message(
                source=receiver.validator_id,
                destination=msg.source,
                msg_type=MessageType.APPEND_ENTRIES_RESPONSE,
                term=term,
                data={
                    "follower_id": receiver.validator_id,
                    "success": success,
                    "match_index": match_index,
                    "reason": reason,
                },
                is_source_online=receiver.is_online,
                is_dest_online=is_leader_online,
            )
            receiver.messages_sent += 1

        elif msg.msg_type == MessageType.APPEND_ENTRIES_RESPONSE:
            follower_id = msg.data.get("follower_id", msg.source)
            success = msg.data.get("success", False)
            match_index = msg.data.get("match_index", 0)

            newly_committed = receiver.handle_append_entries_response(
                follower_id=follower_id,
                term=msg.term,
                success=success,
                match_index=match_index,
            )

            if newly_committed:
                # Immediately broadcast commit advancement to all followers
                self._broadcast_append_entries(receiver)
                for idx in newly_committed:
                    entry = receiver.log[idx - 1]
                    tx_id = entry.tx_id
                    if tx_id in self.transactions:
                        tx = self.transactions[tx_id]
                        tx.mark_committed(commit_time=time.time(), term=entry.term, log_index=idx)
                        self.metrics.record_committed_tx(tx.confirmation_latency_ms or 0.0)
                        self.record_event(
                            severity=EventSeverity.SUCCESS,
                            category=EventCategory.REPLICATION,
                            message=f"Transaction {tx_id} COMMITTED by quorum at log index {idx} (term {entry.term}, latency {tx.confirmation_latency_ms}ms).",
                            details={"tx_id": tx_id, "log_index": idx, "latency_ms": tx.confirmation_latency_ms},
                        )

    async def submit_transaction(self, payload: Any, origin: str = "Client") -> TransactionSchema:
        async with self.lock:
            # 1. Validate leader and quorum availability
            leader = self.validators.get(self.current_leader_id) if self.current_leader_id else None
            online_count = sum(1 for v in self.validators.values() if v.is_online)

            tx = Transaction(payload=payload, origin=origin)
            self.transactions[tx.tx_id] = tx
            self.tx_order.append(tx.tx_id)

            if not leader or not leader.is_online or leader.role != ValidatorRole.LEADER:
                tx.mark_rejected("No active leader elected in cluster. Cannot submit transaction.")
                self.record_event(
                    severity=EventSeverity.ERROR,
                    category=EventCategory.REPLICATION,
                    message=f"Transaction {tx.tx_id} rejected: No active cluster leader available.",
                    details={"payload": payload},
                )
                return tx.to_schema()

            # Quorum warning if leader is in minority partition
            if self.network.partitions:
                leader_part = None
                for part, members in self.network.partitions.items():
                    if leader.validator_id in members:
                        leader_part = members
                if leader_part and len(leader_part) < 3:
                    tx.mark_awaiting_recovery("Leader is in minority partition. Quorum cannot be achieved until partition heals.")
                    self.record_event(
                        severity=EventSeverity.WARNING,
                        category=EventCategory.REPLICATION,
                        message=f"Transaction {tx.tx_id} submitted to leader {leader.validator_id} in minority partition. Commitment suspended until quorum returns.",
                        details={"tx_id": tx.tx_id, "partition_members": list(leader_part)},
                    )
                    # Still append to leader's log as uncommitted
                    leader.append_transaction(tx_id=tx.tx_id, payload=payload)
                    return tx.to_schema()

            # 2. Append to leader's local log
            entry = leader.append_transaction(tx_id=tx.tx_id, payload=payload)
            tx.record_replication(leader.validator_id)

            self.record_event(
                severity=EventSeverity.INFO,
                category=EventCategory.REPLICATION,
                message=f"Transaction {tx.tx_id} appended to Leader {leader.validator_id} log at index {entry.index}.",
                details={"tx_id": tx.tx_id, "index": entry.index, "term": entry.term},
            )

            # 3. Immediately broadcast replication messages to all peers
            self._broadcast_append_entries(leader)

            return tx.to_schema()

    async def stop_validator(self, validator_id: str) -> None:
        async with self.lock:
            v = self.validators.get(validator_id)
            if not v:
                return
            was_leader = (v.role == ValidatorRole.LEADER)
            v.stop()

            if was_leader:
                self.current_leader_id = None
                self.metrics.start_failure_measurement("leader_failure")
                self.record_event(
                    severity=EventSeverity.ERROR,
                    category=EventCategory.ELECTION,
                    message=f"Leader {validator_id} STOPPED! Cluster initiated failover reelection.",
                    details={"validator_id": validator_id},
                )
            else:
                self.record_event(
                    severity=EventSeverity.WARNING,
                    category=EventCategory.SYSTEM,
                    message=f"Validator {validator_id} stopped.",
                    details={"validator_id": validator_id},
                )

    async def start_validator(self, validator_id: str) -> None:
        async with self.lock:
            v = self.validators.get(validator_id)
            if not v:
                return
            v.start()
            self.metrics.start_failure_measurement("validator_recovery")
            self.record_event(
                severity=EventSeverity.SUCCESS,
                category=EventCategory.SYSTEM,
                message=f"Validator {validator_id} RESTORED to network. Synchronizing log with leader.",
                details={"validator_id": validator_id, "current_log_len": len(v.log)},
            )
            # Leader immediately sends AppendEntries to bring it up to date
            if self.current_leader_id:
                leader = self.validators.get(self.current_leader_id)
                if leader and leader.is_online:
                    self._broadcast_append_entries(leader)

    async def set_network_config(self, latency_ms: Optional[float], jitter_ms: Optional[float], drop_rate: Optional[float]) -> None:
        async with self.lock:
            self.network.set_config(latency_ms=latency_ms, jitter_ms=jitter_ms, drop_rate=drop_rate)
            self.record_event(
                severity=EventSeverity.INFO,
                category=EventCategory.NETWORK,
                message=f"Network parameters updated: Latency={self.network.config.latency_ms:.0f}ms, Jitter={self.network.config.jitter_ms:.0f}ms, Loss={int(self.network.config.drop_rate * 100)}%",
                details=self.network.config.model_dump(),
            )

    async def partition_network(self, group_a: List[str], group_b: List[str]) -> None:
        async with self.lock:
            self.network.set_partition(group_a, group_b)
            self.metrics.start_failure_measurement("network_partition")

            for vid in group_a:
                if vid in self.validators:
                    self.validators[vid].partition_id = "group_a"
            for vid in group_b:
                if vid in self.validators:
                    self.validators[vid].partition_id = "group_b"

            self.record_event(
                severity=EventSeverity.WARNING,
                category=EventCategory.NETWORK,
                message=f"Network partitioned! Majority group: {group_a} (3 nodes), Minority group: {group_b} (2 nodes). Communication severed between groups.",
                details={"group_a": group_a, "group_b": group_b},
            )

    async def heal_network(self) -> None:
        async with self.lock:
            self.network.heal_partition()
            for v in self.validators.values():
                v.partition_id = None

            duration = self.metrics.finish_recovery_measurement("network_partition")
            self.record_event(
                severity=EventSeverity.SUCCESS,
                category=EventCategory.NETWORK,
                message=f"Network partition HEALED! Full cluster connectivity restored. Synchronizing lagging logs.",
                details={"recovery_time_sec": duration},
            )
            # Trigger immediate leader broadcast to synchronize all partitions
            if self.current_leader_id:
                leader = self.validators.get(self.current_leader_id)
                if leader and leader.is_online:
                    self._broadcast_append_entries(leader)

    async def inject_malicious_behavior(self, validator_id: str, fault_type: str, details: Optional[Dict[str, Any]] = None) -> None:
        async with self.lock:
            v = self.validators.get(validator_id)
            if not v:
                return
            v.is_malicious = True
            v.malicious_type = fault_type
            v.malicious_details = details or {}

            # If this validator was the leader, step down to FOLLOWER so an honest node leads
            if v.role == ValidatorRole.LEADER:
                v.role = ValidatorRole.FOLLOWER
                self.current_leader_id = None
                for peer_id in ["V1", "V2", "V3", "V4"]:
                    cand = self.validators.get(peer_id)
                    if cand and cand.is_online and not cand.is_malicious:
                        self._trigger_election(cand)
                        break

            # If injecting conflict_entry, immediately plant a rogue uncommitted entry into this validator's log
            if fault_type == "conflict_entry":
                if len(v.log) > 0:
                    target_idx = len(v.log)
                    rogue_entry = LogEntry(
                        index=target_idx,
                        term=v.current_term,
                        tx_id=f"tx-{uuid.uuid4().hex[:8]}",
                        payload={
                            "action": "DOUBLE_SPEND_ATTACK",
                            "recipient": f"attacker_{validator_id.lower()}_wallet",
                            "amount": 99999,
                            "conflict_note": f"Fraudulent double-spend transaction injected into {validator_id}",
                        },
                    )
                    v.log[target_idx - 1] = rogue_entry
                    v.commit_index = min(v.commit_index, target_idx - 1)
                else:
                    rogue_idx = 1
                    rogue_entry = LogEntry(
                        index=rogue_idx,
                        term=v.current_term,
                        tx_id=f"tx-{uuid.uuid4().hex[:8]}",
                        payload={
                            "action": "DOUBLE_SPEND_ATTACK",
                            "recipient": f"attacker_{validator_id.lower()}_wallet",
                            "amount": 99999,
                            "conflict_note": f"Fraudulent double-spend transaction injected into {validator_id}",
                        },
                    )
                    v.log.append(rogue_entry)
                    v.commit_index = 0

            self.record_event(
                severity=EventSeverity.FAULT,
                category=EventCategory.MALICIOUS,
                message=f"Malicious fault injected on {validator_id}: '{fault_type}'. Protocol limitation demonstration active.",
                details={"validator_id": validator_id, "fault_type": fault_type, "details": details},
            )

    async def clear_malicious_behavior(self, validator_id: str) -> None:
        async with self.lock:
            v = self.validators.get(validator_id)
            if not v:
                return
            v.is_malicious = False
            v.malicious_type = None
            v.malicious_details = None

            # Prune uncommitted rogue entries so validator can re-synchronize honest log from leader
            v.log = [
                e for e in v.log
                if not (
                    isinstance(e.payload, dict)
                    and (
                        e.payload.get("action") == "DOUBLE_SPEND_ATTACK"
                        or "conflict_note" in e.payload
                        or "MALICIOUS_FORK" in e.payload
                    )
                )
            ]
            for i, e in enumerate(v.log, 1):
                e.index = i
            v.commit_index = min(v.commit_index, len(v.log))

            self.record_event(
                severity=EventSeverity.INFO,
                category=EventCategory.MALICIOUS,
                message=f"Malicious behavior cleared on {validator_id}. Validator restored to honest protocol mode.",
                details={"validator_id": validator_id},
            )

    async def reset_cluster(self) -> None:
        async with self.lock:
            self.network.reset()
            self._init_validators()
            self.transactions.clear()
            self.tx_order.clear()
            self.current_leader_id = None
            self.current_term = 0
            self.events.clear()
            self.metrics = MetricsTracker(window_seconds=10.0)

            self.record_event(
                severity=EventSeverity.INFO,
                category=EventCategory.SYSTEM,
                message="Cluster reset to clean initial genesis state with 5 honest followers.",
            )

    def get_cluster_status(self) -> ClusterStatusSchema:
        online_count = sum(1 for v in self.validators.values() if v.is_online)
        has_quorum = online_count >= 3 and (self.current_leader_id is not None)

        net_stats = self.network.get_stats()
        metrics_summary = self.metrics.get_summary(
            transactions=list(self.transactions.values()),
            validators=self.validators,
            network_stats=net_stats,
            current_term=self.current_term,
            leader_id=self.current_leader_id,
        )

        return ClusterStatusSchema(
            total_validators=len(self.validators),
            online_validators=online_count,
            current_leader=self.current_leader_id,
            current_term=self.current_term,
            quorum_active=has_quorum,
            active_partition=net_stats["partitions"],
            network_config=self.network.config,
            metrics=metrics_summary,
            adaptive_mode=self.adaptive.config.enabled,
        )

    def get_validator_states(self) -> List[ValidatorStateSchema]:
        return [v.to_schema() for v in self.validators.values()]

    def get_transactions(self) -> List[TransactionSchema]:
        return [self.transactions[tx_id].to_schema() for tx_id in reversed(self.tx_order)]

    def get_events(self) -> List[SimulationEventSchema]:
        return list(reversed(self.events[-100:]))

    def get_ledger_consistency(self) -> LedgerConsistencySchema:
        return self.metrics.check_ledger_consistency(self.validators, self.current_leader_id)

    def get_chart_history(self) -> List[Dict[str, Any]]:
        return list(self.metrics.chart_history)

    async def _notify_subscribers(self) -> None:
        if not self.broadcast_callbacks:
            return
        status = self.get_cluster_status().model_dump()
        payload = {
            "type": "CLUSTER_TICK",
            "cluster": status,
            "validators": [v.to_dict() for v in self.validators.values()],
            "latest_events": [ev.model_dump() for ev in reversed(self.events[-5:])],
            "timestamp": time.time(),
        }
        for cb in self.broadcast_callbacks:
            try:
                res = cb(payload)
                if asyncio.iscoroutine(res):
                    await res
            except Exception:
                pass
