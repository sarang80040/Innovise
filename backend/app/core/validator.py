from __future__ import annotations
import random
import time
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple
from backend.app.schemas.models import (
    LogEntrySchema,
    ValidatorRole,
    ValidatorStateSchema,
)


class LogEntry:
    def __init__(self, index: int, term: int, tx_id: str, payload: Any, timestamp: Optional[float] = None):
        self.index: int = index
        self.term: int = term
        self.tx_id: str = tx_id
        self.payload: Any = payload
        self.timestamp: float = timestamp or time.time()

    def to_schema(self, is_committed: bool = False) -> LogEntrySchema:
        return LogEntrySchema(
            index=self.index,
            term=self.term,
            tx_id=self.tx_id,
            payload=self.payload,
            timestamp=self.timestamp,
            committed=is_committed,
        )

    def to_dict(self, is_committed: bool = False) -> Dict[str, Any]:
        return self.to_schema(is_committed).model_dump()


class Validator:
    def __init__(
        self,
        validator_id: str,
        peers: List[str],
        base_election_timeout_min: float = 1.5,
        base_election_timeout_max: float = 3.0,
        heartbeat_interval: float = 0.5,
    ):
        self.validator_id: str = validator_id
        self.peers: List[str] = [p for p in peers if p != validator_id]
        self.role: ValidatorRole = ValidatorRole.FOLLOWER
        self.current_term: int = 0
        self.voted_for: Optional[str] = None
        self.votes_received: Set[str] = set()

        # Persistent & Volatile State
        self.log: List[LogEntry] = []
        self.commit_index: int = 0
        self.last_applied: int = 0

        # Health & Topology
        self.is_online: bool = True
        self.partition_id: Optional[str] = None

        # Malicious / Fault Injection
        self.is_malicious: bool = False
        self.malicious_type: Optional[str] = None
        self.malicious_details: Optional[Dict[str, Any]] = None

        # Timing configurations
        self.base_election_timeout_min: float = base_election_timeout_min
        self.base_election_timeout_max: float = base_election_timeout_max
        self.heartbeat_interval: float = heartbeat_interval
        self.election_timeout: float = self._randomize_election_timeout()
        self.last_heartbeat_time: float = time.time()
        self.last_heartbeat_sent_time: float = 0.0

        # Leader tracking state
        self.next_index: Dict[str, int] = {}
        self.match_index: Dict[str, int] = {}

        # Message statistics
        self.messages_sent: int = 0
        self.messages_received: int = 0
        self.messages_dropped: int = 0

    def _randomize_election_timeout(self) -> float:
        return random.uniform(self.base_election_timeout_min, self.base_election_timeout_max)

    def reset_election_timer(self) -> None:
        self.last_heartbeat_time = time.time()
        self.election_timeout = self._randomize_election_timeout()

    def update_timeout_bounds(self, min_timeout: float, max_timeout: float, heartbeat_interval: Optional[float] = None) -> None:
        self.base_election_timeout_min = min_timeout
        self.base_election_timeout_max = max_timeout
        if heartbeat_interval is not None:
            self.heartbeat_interval = heartbeat_interval
        self.election_timeout = self._randomize_election_timeout()

    @property
    def last_log_index(self) -> int:
        return self.log[-1].index if self.log else 0

    @property
    def last_log_term(self) -> int:
        return self.log[-1].term if self.log else 0

    def is_election_timeout_expired(self, now: Optional[float] = None) -> bool:
        if not self.is_online:
            return False
        current_time = now or time.time()
        return (current_time - self.last_heartbeat_time) >= self.election_timeout

    def should_send_heartbeat(self, now: Optional[float] = None) -> bool:
        if not self.is_online or self.role != ValidatorRole.LEADER:
            return False
        current_time = now or time.time()
        return (current_time - self.last_heartbeat_sent_time) >= self.heartbeat_interval

    def start_election(self) -> Tuple[int, Dict[str, Any]]:
        """Transitions to Candidate, increments term, votes for self, and prepares RequestVote payload."""
        self.role = ValidatorRole.CANDIDATE
        self.current_term += 1
        self.voted_for = self.validator_id
        self.votes_received = {self.validator_id}
        self.reset_election_timer()

        payload = {
            "term": self.current_term,
            "candidate_id": self.validator_id,
            "last_log_index": self.last_log_index,
            "last_log_term": self.last_log_term,
        }
        return self.current_term, payload

    def handle_request_vote(
        self,
        candidate_term: int,
        candidate_id: str,
        last_log_index: int,
        last_log_term: int,
    ) -> Tuple[int, bool, str]:
        """Processes an incoming RequestVote message according to Raft safety rules."""
        self.messages_received += 1

        if not self.is_online:
            return self.current_term, False, f"Validator {self.validator_id} is offline"

        # Rule 1: Reject if term < current_term
        if candidate_term < self.current_term:
            return self.current_term, False, f"Candidate term {candidate_term} < current term {self.current_term}"

        # Rule 2: If term > current_term, update term and step down
        if candidate_term > self.current_term:
            self.current_term = candidate_term
            self.role = ValidatorRole.FOLLOWER
            self.voted_for = None
            self.votes_received.clear()

        # Rule 3: Check if already voted for someone else in this term
        can_vote = (self.voted_for is None or self.voted_for == candidate_id)

        # Rule 4: Candidate's log must be at least as up-to-date as receiver's log
        log_ok = (last_log_term > self.last_log_term) or (
            last_log_term == self.last_log_term and last_log_index >= self.last_log_index
        )

        vote_granted = can_vote and log_ok

        if vote_granted:
            self.voted_for = candidate_id
            self.reset_election_timer()
            reason = f"Vote granted to {candidate_id} for term {self.current_term}"
        else:
            reason = f"Vote denied to {candidate_id}: can_vote={can_vote}, log_ok={log_ok}"

        return self.current_term, vote_granted, reason

    def handle_request_vote_response(self, voter_id: str, term: int, vote_granted: bool) -> bool:
        """Processes vote response. Returns True if this vote triggers leadership transition."""
        self.messages_received += 1

        if not self.is_online:
            return False

        if term > self.current_term:
            self.current_term = term
            self.role = ValidatorRole.FOLLOWER
            self.voted_for = None
            self.votes_received.clear()
            self.reset_election_timer()
            return False

        if self.role == ValidatorRole.CANDIDATE and term == self.current_term and vote_granted:
            self.votes_received.add(voter_id)
            majority_needed = (len(self.peers) + 1) // 2 + 1
            if len(self.votes_received) >= majority_needed:
                self.become_leader()
                return True

        return False

    def become_leader(self) -> None:
        self.role = ValidatorRole.LEADER
        self.next_index = {peer: len(self.log) + 1 for peer in self.peers}
        self.match_index = {peer: 0 for peer in self.peers}
        self.last_heartbeat_sent_time = 0.0

    def append_transaction(self, tx_id: str, payload: Any) -> LogEntry:
        """Appends a new uncommitted entry to the leader's local log."""
        new_index = len(self.log) + 1
        entry = LogEntry(index=new_index, term=self.current_term, tx_id=tx_id, payload=payload)
        self.log.append(entry)
        return entry

    def create_append_entries(self, peer_id: str) -> Dict[str, Any]:
        """Creates AppendEntries payload for a specific follower (heartbeat or replication)."""
        next_idx = self.next_index.get(peer_id, len(self.log) + 1)
        prev_log_index = next_idx - 1
        prev_log_term = self.log[prev_log_index - 1].term if prev_log_index > 0 and prev_log_index <= len(self.log) else 0

        # Entries to send from prev_log_index up to end of log
        entries_to_send = [
            e.to_dict(is_committed=(e.index <= self.commit_index))
            for e in self.log[prev_log_index:]
        ]

        # Malicious behavior: disrupt replication
        if self.is_malicious and self.malicious_type == "disrupt_replication":
            entries_to_send = []

        return {
            "term": self.current_term,
            "leader_id": self.validator_id,
            "prev_log_index": prev_log_index,
            "prev_log_term": prev_log_term,
            "entries": entries_to_send,
            "leader_commit": self.commit_index,
        }

    def handle_append_entries(
        self,
        leader_term: int,
        leader_id: str,
        prev_log_index: int,
        prev_log_term: int,
        entries: List[Dict[str, Any]],
        leader_commit: int,
    ) -> Tuple[int, bool, int, str]:
        """Handles incoming AppendEntries message (heartbeat or log replication)."""
        self.messages_received += 1

        if not self.is_online:
            return self.current_term, False, 0, f"Validator {self.validator_id} is offline"

        # Rule 1: Reject if leader term < current_term
        if leader_term < self.current_term:
            return self.current_term, False, len(self.log), f"Leader term {leader_term} < current term {self.current_term}"

        # Rule 2: If term >= current_term, acknowledge leader and reset heartbeat timer
        if leader_term > self.current_term or self.role != ValidatorRole.FOLLOWER:
            self.current_term = leader_term
            self.role = ValidatorRole.FOLLOWER
            self.voted_for = leader_id
            self.votes_received.clear()

        # Always update heartbeat timer on message from legitimate leader
        self.last_heartbeat_time = time.time()

        # Malicious behaviors on Follower (triggers when entries are replicated or for fabricated ACKs):
        if self.is_malicious:
            if self.malicious_type == "fabricate_ack":
                # Byzantine lie: sends positive ACK without saving entry
                fake_match = prev_log_index + len(entries)
                return self.current_term, True, fake_match, "Fabricated ACK sent by malicious follower"

            elif self.malicious_type == "disrupt_replication" and entries:
                # Sabotage: drops replication entry, refuses to ACK, attempting to stall quorum
                self.messages_dropped += 1
                return self.current_term, False, len(self.log), f"Malicious validator {self.validator_id} dropped replication packet (sabotage)"

            elif self.malicious_type == "conflict_entry" and entries:
                # Fork attack: deliberately stores a completely conflicting, uncommitted transaction
                for entry_dict in entries:
                    e_idx = entry_dict["index"]
                    # If this index already holds a conflicting entry, persist it (do not regenerate on retry)
                    if e_idx <= len(self.log):
                        existing = self.log[e_idx - 1]
                        if isinstance(existing.payload, dict) and (
                            existing.payload.get("action") == "DOUBLE_SPEND_ATTACK" or "conflict_note" in existing.payload
                        ):
                            continue

                    rogue_entry = LogEntry(
                        index=e_idx,
                        term=self.current_term,
                        tx_id=f"tx-{uuid.uuid4().hex[:8]}",
                        payload={
                            "action": "DOUBLE_SPEND_ATTACK",
                            "recipient": f"attacker_{self.validator_id.lower()}_wallet",
                            "amount": 99999,
                            "conflict_note": f"Fraudulent double-spend transaction injected by {self.validator_id}",
                        },
                    )
                    if e_idx <= len(self.log):
                        self.log[e_idx - 1] = rogue_entry
                    else:
                        self.log.append(rogue_entry)
                    # Ensure conflicting entries are strictly uncommitted on the rogue follower
                    self.commit_index = min(self.commit_index, e_idx - 1)
                # Keep uncommitted on follower, return False so leader does not count this node
                return self.current_term, False, len(self.log), f"Malicious validator {self.validator_id} generated conflicting log fork"

            elif self.malicious_type == "invalid_payload" and entries:
                # Rejects transaction proposal as invalid
                return self.current_term, False, len(self.log), f"Malicious validator {self.validator_id} rejected proposal as invalid"

        # Rule 3: Check log continuity at prev_log_index
        if prev_log_index > 0:
            if len(self.log) < prev_log_index:
                # Log too short, follower is missing entries
                return self.current_term, False, len(self.log), f"Log too short (have {len(self.log)}, need {prev_log_index})"

            if self.log[prev_log_index - 1].term != prev_log_term:
                # Term mismatch at prev_log_index: delete conflicting suffix
                self.log = self.log[:prev_log_index - 1]
                return self.current_term, False, len(self.log), f"Term mismatch at index {prev_log_index}"

        # Rule 4: Append new entries, resolving conflicts
        for entry_dict in entries:
            e_idx = entry_dict["index"]
            e_term = entry_dict["term"]
            e_tx = entry_dict["tx_id"]
            e_payload = entry_dict["payload"]
            e_ts = entry_dict.get("timestamp", time.time())

            if e_idx <= len(self.log):
                # If entry exists and term matches, keep it; if term differs, truncate
                if self.log[e_idx - 1].term != e_term:
                    self.log = self.log[:e_idx - 1]
                    self.log.append(LogEntry(index=e_idx, term=e_term, tx_id=e_tx, payload=e_payload, timestamp=e_ts))
            else:
                self.log.append(LogEntry(index=e_idx, term=e_term, tx_id=e_tx, payload=e_payload, timestamp=e_ts))

        # Rule 5: Update commit_index
        if leader_commit > self.commit_index:
            # If this node is holding an uncommitted rogue conflict entry, do not mark it committed
            safe_commit = 0
            has_conflict = False
            for entry in self.log:
                is_conflict = (
                    isinstance(entry.payload, dict)
                    and (
                        entry.payload.get("action") == "DOUBLE_SPEND_ATTACK"
                        or "conflict_note" in entry.payload
                        or "MALICIOUS_FORK" in entry.payload
                    )
                )
                if is_conflict or entry.tx_id.startswith("fork-"):
                    has_conflict = True
                    break
                safe_commit = entry.index

            if has_conflict or (self.is_malicious and self.malicious_type == "conflict_entry"):
                self.commit_index = min(leader_commit, safe_commit)
            else:
                self.commit_index = min(leader_commit, len(self.log))
            self.last_applied = self.commit_index

        match_index = len(self.log)
        return self.current_term, True, match_index, "Appended and acknowledged successfully"

    def handle_append_entries_response(
        self,
        follower_id: str,
        term: int,
        success: bool,
        match_index: int,
    ) -> List[int]:
        """Handles follower's replication ACK. Updates match_index and checks quorum for commit.
        Returns list of newly committed log indices, if any."""
        self.messages_received += 1

        if not self.is_online or self.role != ValidatorRole.LEADER:
            return []

        if term > self.current_term:
            self.current_term = term
            self.role = ValidatorRole.FOLLOWER
            self.voted_for = None
            self.votes_received.clear()
            self.reset_election_timer()
            return []

        if term != self.current_term:
            return []

        if success:
            self.next_index[follower_id] = match_index + 1
            self.match_index[follower_id] = match_index

            # Check quorum for committing entries
            newly_committed: List[int] = []
            majority_needed = (len(self.peers) + 1) // 2 + 1  # 3 for 5 nodes

            for n in range(self.commit_index + 1, len(self.log) + 1):
                # Only commit entries from current term (standard Raft safety rule 5.4.2)
                if self.log[n - 1].term == self.current_term:
                    # Count acknowledgments: leader itself (1) + followers with match_index >= n
                    count = 1 + sum(1 for peer, idx in self.match_index.items() if idx >= n)
                    if count >= majority_needed:
                        self.commit_index = n
                        self.last_applied = n
                        newly_committed.append(n)

            return newly_committed
        else:
            # Step back next_index for follower to find agreement point
            current_next = self.next_index.get(follower_id, len(self.log) + 1)
            self.next_index[follower_id] = max(1, min(current_next - 1, match_index + 1))
            return []

    def stop(self) -> None:
        self.is_online = False
        self.role = ValidatorRole.FOLLOWER

    def start(self) -> None:
        self.is_online = True
        self.reset_election_timer()

    def get_log_entries(self) -> List[LogEntrySchema]:
        return [e.to_schema(is_committed=(e.index <= self.commit_index)) for e in self.log]

    def to_schema(self) -> ValidatorStateSchema:
        return ValidatorStateSchema(
            validator_id=self.validator_id,
            role=self.role,
            current_term=self.current_term,
            voted_for=self.voted_for,
            log_length=len(self.log),
            commit_index=self.commit_index,
            last_applied=self.last_applied,
            is_online=self.is_online,
            partition_id=self.partition_id,
            is_malicious=self.is_malicious,
            malicious_type=self.malicious_type,
            messages_sent=self.messages_sent,
            messages_received=self.messages_received,
            messages_dropped=self.messages_dropped,
            last_heartbeat_time=self.last_heartbeat_time,
        )

    def to_dict(self) -> Dict[str, Any]:
        return self.to_schema().model_dump()
