export type ValidatorRole = 'LEADER' | 'FOLLOWER' | 'CANDIDATE';

export type TransactionStatus =
  | 'PENDING'
  | 'REPLICATED'
  | 'COMMITTED'
  | 'REJECTED'
  | 'AWAITING_RECOVERY'
  | 'SUSPICIOUS';

export type EventSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'FAULT';

export type EventCategory =
  | 'ELECTION'
  | 'REPLICATION'
  | 'NETWORK'
  | 'ADAPTIVE'
  | 'MALICIOUS'
  | 'SYSTEM';

export interface LogEntry {
  index: number;
  term: number;
  tx_id: string;
  payload: any;
  timestamp: number;
  committed: boolean;
}

export interface ValidatorState {
  validator_id: string;
  role: ValidatorRole;
  current_term: number;
  voted_for: string | null;
  log_length: number;
  commit_index: number;
  last_applied: number;
  is_online: boolean;
  partition_id: string | null;
  is_malicious: boolean;
  malicious_type: string | null;
  messages_sent: number;
  messages_received: number;
  messages_dropped: number;
  last_heartbeat_time: number;
}

export interface Transaction {
  tx_id: string;
  payload: any;
  submission_time: number;
  origin: string;
  status: TransactionStatus;
  replicated_to: string[];
  replicated_count: number;
  confirmation_time: number | null;
  confirmation_latency_ms: number | null;
  term: number | null;
  log_index: number | null;
  error_message: string | null;
  is_malicious: boolean;
  malicious_note: string | null;
}

export interface SimulationEvent {
  event_id: string;
  timestamp: number;
  severity: EventSeverity;
  category: EventCategory;
  message: string;
  details?: Record<string, any>;
}

export interface NetworkConfig {
  latency_ms: number;
  jitter_ms: number;
  drop_rate: number;
}

export interface MetricsSummary {
  total_submitted: number;
  total_committed: number;
  total_pending: number;
  total_rejected: number;
  throughput_tps: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  total_messages_sent: number;
  total_messages_delivered: number;
  total_messages_dropped: number;
  message_drop_rate: number;
  active_quorum: boolean;
  majority_count_required: number;
  online_validator_count: number;
  current_term: number;
  current_leader: string | null;
  recovery_time_last_sec: number | null;
  election_duration_last_sec: number | null;
  consistency_percentage: number;
}

export interface ClusterStatus {
  total_validators: number;
  online_validators: number;
  current_leader: string | null;
  current_term: number;
  quorum_active: boolean;
  active_partition: Record<string, string[]> | null;
  network_config: NetworkConfig;
  metrics: MetricsSummary;
  adaptive_mode: boolean;
}

export interface ConflictRecord {
  log_index: number;
  severity: string;
  discrepancy: Record<string, { term: number; tx_id: string; committed: boolean }>;
  description: string;
}

export interface LedgerConsistency {
  is_consistent: boolean;
  safety_violation: boolean;
  online_count: number;
  synchronized_count: number;
  lagging_count: number;
  offline_count: number;
  highest_commit_index: number;
  common_prefix_length: number;
  conflicts: ConflictRecord[];
  validator_summaries: {
    validator_id: string;
    is_online: boolean;
    commit_index: number;
    log_length: number;
    status: string;
  }[];
  explanation: string;
}

export interface ChartPoint {
  timestamp: string;
  time_sec: number;
  throughput: number;
  latency_ms: number;
  online_validators: number;
  message_drops: number;
  consistency: number;
}

export interface ExperimentReport {
  experiment_id: string;
  name: string;
  description: string;
  config: Record<string, any>;
  start_time: number;
  end_time: number;
  duration_sec: number;
  submitted_count: number;
  committed_count: number;
  rejected_count: number;
  throughput_tps: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  election_duration_sec: number | null;
  recovery_time_sec: number | null;
  message_drop_count: number;
  safety_violations_count: number;
  is_consistent: boolean;
  consistency_details: any;
  observations: string[];
  protocol_notes: string;
}
