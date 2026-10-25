from __future__ import annotations
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ValidatorRole(str, Enum):
    LEADER = "LEADER"
    FOLLOWER = "FOLLOWER"
    CANDIDATE = "CANDIDATE"


class TransactionStatus(str, Enum):
    PENDING = "PENDING"
    REPLICATED = "REPLICATED"
    COMMITTED = "COMMITTED"
    REJECTED = "REJECTED"
    AWAITING_RECOVERY = "AWAITING_RECOVERY"
    SUSPICIOUS = "SUSPICIOUS"


class EventSeverity(str, Enum):
    INFO = "INFO"
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    ERROR = "ERROR"
    FAULT = "FAULT"


class EventCategory(str, Enum):
    ELECTION = "ELECTION"
    REPLICATION = "REPLICATION"
    NETWORK = "NETWORK"
    ADAPTIVE = "ADAPTIVE"
    MALICIOUS = "MALICIOUS"
    SYSTEM = "SYSTEM"


class LogEntrySchema(BaseModel):
    index: int
    term: int
    tx_id: str
    payload: Any
    timestamp: float
    committed: bool = False


class ValidatorStateSchema(BaseModel):
    validator_id: str
    role: ValidatorRole
    current_term: int
    voted_for: Optional[str] = None
    log_length: int
    commit_index: int
    last_applied: int
    is_online: bool
    partition_id: Optional[str] = None
    is_malicious: bool = False
    malicious_type: Optional[str] = None
    messages_sent: int = 0
    messages_received: int = 0
    messages_dropped: int = 0
    last_heartbeat_time: float = 0.0


class TransactionSubmitRequest(BaseModel):
    payload: Any = Field(default="Transfer 10 tokens", description="Arbitrary transaction payload")
    origin: str = Field(default="Client-Dashboard", description="Originating client or validator")


class TransactionSchema(BaseModel):
    tx_id: str
    payload: Any
    submission_time: float
    origin: str
    status: TransactionStatus
    replicated_to: List[str] = []
    replicated_count: int = 0
    confirmation_time: Optional[float] = None
    confirmation_latency_ms: Optional[float] = None
    term: Optional[int] = None
    log_index: Optional[int] = None
    error_message: Optional[str] = None
    is_malicious: bool = False
    malicious_note: Optional[str] = None


class NetworkConfigSchema(BaseModel):
    latency_ms: float = Field(default=30.0, ge=0.0, le=5000.0)
    jitter_ms: float = Field(default=10.0, ge=0.0, le=1000.0)
    drop_rate: float = Field(default=0.0, ge=0.0, le=1.0)


class NetworkPartitionRequest(BaseModel):
    group_a: List[str] = Field(default=["V1", "V2", "V3"])
    group_b: List[str] = Field(default=["V4", "V5"])


class MaliciousInjectRequest(BaseModel):
    validator_id: str
    fault_type: str = Field(
        ...,
        description="One of: invalid_payload, conflict_entry, fabricate_ack, disrupt_replication",
    )
    details: Optional[Dict[str, Any]] = None


class AdaptiveConfigSchema(BaseModel):
    enabled: bool = True
    base_election_timeout_min: float = 1.5
    base_election_timeout_max: float = 3.0
    base_heartbeat_interval: float = 0.5


class SimulationEventSchema(BaseModel):
    event_id: str
    timestamp: float
    severity: EventSeverity
    category: EventCategory
    message: str
    details: Optional[Dict[str, Any]] = None


class ConsistencyDetailsSchema(BaseModel):
    validator_id: str
    is_online: bool
    commit_index: int
    log_length: int
    status: str  # "SYNCHRONIZED", "LAGGING", "OFFLINE", "AWAITING_RECOVERY", "CONFLICT"


class LedgerConsistencySchema(BaseModel):
    is_consistent: bool
    safety_violation: bool
    online_count: int
    synchronized_count: int
    lagging_count: int
    offline_count: int
    highest_commit_index: int
    common_prefix_length: int
    conflicts: List[Dict[str, Any]] = []
    validator_summaries: List[ConsistencyDetailsSchema] = []
    explanation: str


class MetricsSummarySchema(BaseModel):
    total_submitted: int
    total_committed: int
    total_pending: int
    total_rejected: int
    throughput_tps: float
    avg_latency_ms: Optional[float]
    p95_latency_ms: Optional[float]
    total_messages_sent: int
    total_messages_delivered: int
    total_messages_dropped: int
    message_drop_rate: float
    active_quorum: bool
    majority_count_required: int = 3
    online_validator_count: int
    current_term: int
    current_leader: Optional[str]
    recovery_time_last_sec: Optional[float] = None
    election_duration_last_sec: Optional[float] = None
    consistency_percentage: float = 100.0


class ClusterStatusSchema(BaseModel):
    total_validators: int = 5
    online_validators: int
    current_leader: Optional[str]
    current_term: int
    quorum_active: bool
    active_partition: Optional[Dict[str, List[str]]]
    network_config: NetworkConfigSchema
    metrics: MetricsSummarySchema
    adaptive_mode: bool
