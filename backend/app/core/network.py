from __future__ import annotations
import random
import time
import uuid
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set
from backend.app.schemas.models import NetworkConfigSchema


class MessageType(str, Enum):
    HEARTBEAT = "HEARTBEAT"
    REQUEST_VOTE = "REQUEST_VOTE"
    REQUEST_VOTE_RESPONSE = "REQUEST_VOTE_RESPONSE"
    APPEND_ENTRIES = "APPEND_ENTRIES"
    APPEND_ENTRIES_RESPONSE = "APPEND_ENTRIES_RESPONSE"


class NetworkMessage:
    def __init__(
        self,
        source: str,
        destination: str,
        msg_type: MessageType,
        term: int,
        data: Dict[str, Any],
        delay_ms: float = 0.0,
        message_id: Optional[str] = None,
    ):
        self.message_id: str = message_id or f"msg-{uuid.uuid4().hex[:8]}"
        self.source: str = source
        self.destination: str = destination
        self.msg_type: MessageType = msg_type
        self.term: int = term
        self.data: Dict[str, Any] = data
        self.created_at: float = time.time()
        self.delay_ms: float = delay_ms
        self.deliver_at: float = self.created_at + (delay_ms / 1000.0)
        self.delivered: bool = False
        self.dropped: bool = False
        self.drop_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message_id": self.message_id,
            "source": self.source,
            "destination": self.destination,
            "msg_type": self.msg_type.value,
            "term": self.term,
            "data": self.data,
            "created_at": self.created_at,
            "delay_ms": self.delay_ms,
            "delivered": self.delivered,
            "dropped": self.dropped,
            "drop_reason": self.drop_reason,
        }


class NetworkSimulator:
    def __init__(
        self,
        config: Optional[NetworkConfigSchema] = None,
        on_event_callback: Optional[Callable[[str, str, str, Dict[str, Any]], None]] = None,
    ):
        self.config: NetworkConfigSchema = config or NetworkConfigSchema()
        self.on_event: Optional[Callable[[str, str, str, Dict[str, Any]], None]] = on_event_callback
        # Partition membership: maps partition_name -> Set[validator_id]
        # None means no active partition
        self.partitions: Optional[Dict[str, Set[str]]] = None

        self.pending_queue: List[NetworkMessage] = []
        self.history: List[NetworkMessage] = []
        self.max_history: int = 400

        # Metrics
        self.total_sent: int = 0
        self.total_delivered: int = 0
        self.total_dropped: int = 0

    def set_config(self, latency_ms: Optional[float] = None, jitter_ms: Optional[float] = None, drop_rate: Optional[float] = None) -> None:
        if latency_ms is not None:
            self.config.latency_ms = max(0.0, latency_ms)
        if jitter_ms is not None:
            self.config.jitter_ms = max(0.0, jitter_ms)
        if drop_rate is not None:
            self.config.drop_rate = max(0.0, min(1.0, drop_rate))

    def set_partition(self, group_a: List[str], group_b: List[str]) -> None:
        self.partitions = {
            "group_a": set(group_a),
            "group_b": set(group_b),
        }

    def heal_partition(self) -> None:
        self.partitions = None

    def are_partitioned(self, source: str, destination: str) -> bool:
        if not self.partitions:
            return False
        # If in different groups, they cannot communicate
        src_group = None
        dest_group = None
        for group_name, members in self.partitions.items():
            if source in members:
                src_group = group_name
            if destination in members:
                dest_group = group_name
        if src_group and dest_group and src_group != dest_group:
            return True
        return False

    def send_message(
        self,
        source: str,
        destination: str,
        msg_type: MessageType,
        term: int,
        data: Dict[str, Any],
        is_source_online: bool,
        is_dest_online: bool,
    ) -> Optional[NetworkMessage]:
        self.total_sent += 1

        # Calculate simulated delay with jitter
        jitter = random.uniform(-self.config.jitter_ms, self.config.jitter_ms) if self.config.jitter_ms > 0 else 0
        delay_ms = max(2.0, self.config.latency_ms + jitter)

        msg = NetworkMessage(
            source=source,
            destination=destination,
            msg_type=msg_type,
            term=term,
            data=data,
            delay_ms=delay_ms,
        )

        # Check offline conditions
        if not is_source_online:
            msg.dropped = True
            msg.drop_reason = f"Source {source} is offline"
            self.total_dropped += 1
            self._record_history(msg)
            return msg

        if not is_dest_online:
            msg.dropped = True
            msg.drop_reason = f"Destination {destination} is offline"
            self.total_dropped += 1
            self._record_history(msg)
            return msg

        # Check partition boundary
        if self.are_partitioned(source, destination):
            msg.dropped = True
            msg.drop_reason = f"Network partition blocked communication ({source} -> {destination})"
            self.total_dropped += 1
            self._record_history(msg)
            return msg

        # Check random packet drop rate
        if self.config.drop_rate > 0.0 and random.random() < self.config.drop_rate:
            msg.dropped = True
            msg.drop_reason = f"Simulated network packet drop (loss rate: {int(self.config.drop_rate * 100)}%)"
            self.total_dropped += 1
            self._record_history(msg)
            return msg

        # Enqueue for asynchronous delivery after delay
        self.pending_queue.append(msg)
        return msg

    def pull_ready_messages(self, now: Optional[float] = None) -> List[NetworkMessage]:
        current_time = now or time.time()
        ready: List[NetworkMessage] = []
        remaining: List[NetworkMessage] = []

        for msg in self.pending_queue:
            if msg.deliver_at <= current_time:
                msg.delivered = True
                self.total_delivered += 1
                self._record_history(msg)
                ready.append(msg)
            else:
                remaining.append(msg)

        self.pending_queue = remaining
        return ready

    def _record_history(self, msg: NetworkMessage) -> None:
        self.history.append(msg)
        if len(self.history) > self.max_history:
            self.history.pop(0)

    def get_stats(self) -> Dict[str, Any]:
        drop_rate_actual = (self.total_dropped / self.total_sent) if self.total_sent > 0 else 0.0
        return {
            "total_sent": self.total_sent,
            "total_delivered": self.total_delivered,
            "total_dropped": self.total_dropped,
            "drop_rate_actual": round(drop_rate_actual, 4),
            "pending_count": len(self.pending_queue),
            "configured_latency_ms": self.config.latency_ms,
            "configured_drop_rate": self.config.drop_rate,
            "is_partitioned": self.partitions is not None,
            "partitions": {k: list(v) for k, v in self.partitions.items()} if self.partitions else None,
        }

    def reset(self) -> None:
        self.pending_queue.clear()
        self.history.clear()
        self.partitions = None
        self.total_sent = 0
        self.total_delivered = 0
        self.total_dropped = 0
