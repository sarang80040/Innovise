# ConsensusPulse: Blockchain Consensus Failure Simulator
### Adaptive Distributed Consensus Under Network Failures, Partitions, and Malicious Validators

ConsensusPulse is an educational, production-grade distributed systems consensus simulator designed to demonstrate and benchmark consensus behavior when network conditions degrade, validators crash, partitions form, and malicious behavior is injected.

Built with **Python 3.11+ / FastAPI / asyncio / Pydantic** on the backend and **React / Vite / TypeScript / Tailwind CSS / Recharts** on the frontend, it simulates true independent node state machines, simulated asynchronous network message routing with configurable latencies and packet losses, quorum enforcement, leader elections, and log replication.

---

## 1. System Architecture

The project is decoupled into independent layers:

```
                              ┌─────────────────────────────────────────┐
                              │            React Frontend (Vite)        │
                              │  - Topology Graph  - Telemetry Charts   │
                              │  - Failure Controls - Tx & Log Explorer │
                              └────────────────────▲────────────────────┘
                                                   │ HTTP REST + WebSocket
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                FastAPI Backend Service                                 │
│                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐  │
│  │   REST & WS Router    │   │  Adaptive Controller  │   │     Metrics Tracker      │  │
│  │  - /api/cluster       │   │  - Dynamic Timeouts   │   │  - Throughput (TPS)      │  │
│  │  - /api/transactions  │   │  - Policy Decisions   │   │  - Confirmation Latency  │  │
│  │  - /api/experiments   │   │  - State Classifier   │   │  - Recovery Time         │  │
│  └───────────┬───────────┘   └───────────┬───────────┘   └────────────┬─────────────┘  │
│              │                           │                            │                │
│              └───────────────────────────┼────────────────────────────┘                │
│                                          ▼                                             │
│                           ┌──────────────────────────────┐                             │
│                           │      ClusterCoordinator     │                             │
│                           └──────────────┬───────────────┘                             │
│                                          │                                             │
│              ┌───────────────────────────┴───────────────────────────┐                 │
│              ▼                                                       ▼                 │
│   ┌─────────────────────┐                                 ┌─────────────────────┐      │
│   │  Network Simulator  │◄───────────────────────────────►│  5 Raft Validators  │      │
│   │  - Latency & Jitter │   Heartbeats, AppendEntries,    │  - Independent Logs │      │
│   │  - Packet Drops     │   RequestVote, Acknowledgments  │  - Commit Index     │      │
│   │  - 3v2 Partitions   │                                 │  - V1, V2, V3, V4,V5│      │
│   └─────────────────────┘                                 └─────────────────────┘      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown
1. **Raft Validators (`backend/app/core/validator.py`)**:
   - Five independent state machines: `V1`, `V2`, `V3`, `V4`, `V5`.
   - Independent transaction logs (`List[LogEntry]`), `commit_index`, `last_applied`, term counters, and voting state.
   - Nodes do NOT share state through globals; all interactions occur through simulated network messages.
2. **Network Simulator (`backend/app/core/network.py`)**:
   - Models asynchronous packet transmission with configurable round-trip latency (ms), random jitter, and packet drop probability (0% - 50%).
   - Simulates physical network partitions (e.g., Majority `[V1, V2, V3]` vs Minority `[V4, V5]`), dropping inter-partition traffic.
3. **Adaptive Network Controller (`backend/app/core/adaptive.py`)**:
   - Continuously monitors packet loss, latency spikes, and election frequency.
   - Autonomously tunes consensus timeouts within safe bounds (1.5s - 5.5s) to prevent election storms under degraded network conditions.
4. **Metrics & Auditor (`backend/app/core/metrics.py`)**:
   - Computes real-time throughput (TPS over a sliding window), confirmation latency (average and p95 in ms), and recovery durations.
   - Runs cross-validator ledger audits to verify that committed prefixes match 100% and flags any divergence or safety violation.
5. **Experiment Runner (`backend/app/core/experiments.py`)**:
   - Standardized test harness for five automated scenarios (A, B, C, D, E) producing exportable JSON telemetry reports.

---

## 2. Requirements & Setup

### Prerequisites
- **Operating System**: Linux (Ubuntu, Debian, Fedora, Arch Linux, etc.)
- **Python**: 3.11, 3.12, 3.13, or 3.14
- **Node.js**: v18.0.0 or newer
- **npm**: v9.0.0 or newer

### Setup on Linux (including Arch Linux)

#### 1. Clone or Open Workspace
```bash
cd /path/to/inovise_ps3
```

#### 2. Install System Dependencies (if not already present)
- **Ubuntu / Debian**:
  ```bash
  sudo apt update && sudo apt install -y python3 python3-venv python3-pip nodejs npm curl
  ```
- **Arch Linux**:
  ```bash
  sudo pacman -Syu python python-pip nodejs npm curl
  ```

#### 3. Automatic Startup via `start.sh`
The included `start.sh` script automates virtual environment creation, dependency installation, service launch, and healthchecks:

```bash
chmod +x start.sh
./start.sh
```

When started, access the application at:
- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Interactive REST API Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Endpoint**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Live WebSocket Stream**: `ws://localhost:8000/ws`

---

## 3. Running Automated Tests

Consensus correctness and edge-case handling are verified by 19 automated pytest tests:

```bash
# Activate virtual environment
source backend/venv/bin/activate

# Run pytest test suite
PYTHONPATH=. pytest backend/tests -v
```

### Verified Test Cases:
1. `test_01_leader_election`: Majority vote election of a single leader.
2. `test_02_majority_quorum_enforcement`: 3 of 5 majority requirement.
3. `test_03_transaction_commitment_with_quorum`: Transaction replication and commit.
4. `test_04_failure_to_commit_without_quorum`: Minority cannot commit entries.
5. `test_05_three_versus_two_partition`: 3v2 split majority progress vs minority stall.
6. `test_06_leader_failure_and_reelection`: Leader crash and automatic failover.
7. `test_07_follower_recovery_and_synchronization`: Catch-up sync of returning nodes.
8. `test_08_message_drops_handling`: Tolerance to packet drops without safety loss.
9. `test_09_preservation_of_committed_entries_after_recovery`: Committed prefix durability.
10. `test_10_committed_prefix_consistency_calculation`: Prefix audit and safety check.
11. `test_11_accurate_throughput_calculation`: Real-time TPS sliding window calculation.
12. `test_12_accurate_confirmation_latency_calculation`: Exact average and p95 calculation.
13. `test_13_accurate_recovery_time_calculation`: Accurate recovery stopwatch timing.
14. `test_14_network_healing_and_reconciliation`: Reconnection and log catch-up.
15. `test_15_malicious_fault_injection`: Byzantine fault injection logging.
16. `test_16_cluster_reset`: Genesis state restoration.
17. `test_17_websocket_broadcast`: Live telemetry frame transmission.
18. `test_18_rest_api_endpoints`: Comprehensive REST endpoint test.
19. `test_19_experiment_runner`: Automated scenario execution and JSON export.

---

## 4. Consensus Protocol & Quorum Rules

### Consensus Algorithm: Simplified Raft
The cluster uses a simplified Raft protocol:
- **Election Timers**: Each follower sets a randomized countdown (1.5s - 3.0s baseline).
- **Candidate State**: If no heartbeat is received within the timeout, a node increments `current_term`, votes for itself, and broadcasts `RequestVote`.
- **Voting Safety**: A validator votes for at most one candidate per term, and only if the candidate's log is at least as up-to-date as its own (`last_log_term > my_last_log_term` or same term with `last_log_index >= my_last_log_index`).
- **Quorum Enforcement**: In a 5-validator cluster:
  $$\text{Quorum} = \lfloor 5 / 2 \rfloor + 1 = 3$$
  A candidate becomes `LEADER` only upon receiving votes from $\ge 3$ validators.
- **Log Replication**:
  - The leader appends submitted transactions to its local log.
  - The leader broadcasts `AppendEntries` containing uncommitted entries.
  - Follower validates term continuity. If `prev_log_index` / `prev_log_term` match, it appends the entries and acknowledges (`success = True, match_index = N`).
  - When $\ge 3$ nodes acknowledge index $N$, the leader advances `commit_index = N` and marks the transaction `COMMITTED`.
  - In subsequent heartbeats, followers receive the new `leader_commit` and advance their local commit indices.

---

## 5. Experiment Suite

| Experiment | Scenario | Purpose & Expected Behavior |
|---|---|---|
| **Experiment A** | **Normal Operation** | 5 honest nodes, 30ms latency, 0% drop rate. Measures baseline TPS and confirmation latency (~50-80ms). Verifies 100% prefix consistency. |
| **Experiment B** | **Leader Failure & Crash Recovery** | Crashes the active leader. Demonstrates failover election (~1.5-2.5s). New leader commits transactions. Restores old leader and verifies catch-up synchronization. |
| **Experiment C** | **Network Partition (3 vs 2)** | Partitions cluster into Majority `[V1, V2, V3]` and Minority `[V4, V5]`. Demonstrates that Majority commits new blocks, while Minority stalls to prevent split-brain. Heals partition and audits reconciliation. |
| **Experiment D** | **High Latency & Packet Loss** | Injects 150ms round-trip latency and 20% packet drops. Measures latency degradation. Shows Adaptive Network Controller expanding election timeouts to stabilize leadership. |
| **Experiment E** | **Malicious Fault Injection** | Designates a node as malicious and injects fabricated acknowledgments or conflicting uncommitted entries. Demonstrates the boundaries of crash-fault consensus. |

---

## 6. Why Ordinary Raft is NOT Byzantine Fault Tolerant (BFT)

A critical concept for distributed systems and blockchain hackathons:

1. **Crash Fault Tolerance (CFT)**:
   - Raft is mathematically proven for **CFT**.
   - It assumes nodes are either **correct** (following the state machine) or **crashed/silent** (failing to respond or rebooting with persistent state).
   - Up to $f$ crashes can be tolerated in a cluster of $2f + 1$ nodes (2 failures in a 5-node cluster).
2. **The Byzantine Fault Problem**:
   - In open blockchains, nodes can be malicious, collusive, or compromised.
   - An adversary might:
     - **Equivocate**: Send different vote responses or divergent log entries to different peers in the same term.
     - **Fabricate ACKs**: Acknowledge transactions without actually persisting them to storage, causing data loss if the leader commits and crashes.
     - **Manipulate Timers**: Spam invalid terms to trigger continuous leader elections (liveness attack).
3. **What is Required for True BFT?**:
   - Protocols such as **PBFT, Tendermint, or HotStuff** require:
     - Cryptographic digital signatures (ECDSA/BLS) on every message.
     - A $3f + 1$ node requirement (tolerating at most $f$ Byzantine nodes; e.g., 4 nodes needed to tolerate 1 Byzantine node).
     - Two-phase voting (`Pre-Prepare` $\to$ `Prepare` $\to$ `Commit`) with signed quorum certificates (QCs).

ConsensusPulse allows demonstrating this exact distinction to hackathon judges via Experiment E.

---

## 7. Performance Metric Definitions

- **Throughput (TPS)**:
  $$\text{TPS} = \frac{\text{Committed Transactions in Window}}{\Delta t_{\text{window}}}$$
  Calculated over a rolling 10-second sliding window of confirmed commits.
- **Confirmation Latency**:
  $$\text{Latency} = t_{\text{commit}} - t_{\text{submission}}$$
  Measured strictly for committed transactions. Uncommitted or rejected transactions are excluded from latency averages.
- **Recovery Duration**:
  Measured via stopwatch from failure injection until the recovery criteria is met (e.g., from leader crash until new leader commits a block, or from partition healing until 100% ledger consistency is verified).
- **Committed-Ledger Consistency**:
  Audits all online validators at every log index $1 \dots \text{commit\_index}$. Distinguishes harmless uncommitted suffixes from safety violations (two validators committing conflicting entries at the same index).

---

## 8. Troubleshooting

- **Node.js shared library issue on Arch Linux**:
  If `node: error while loading shared libraries: libada.so.3` appears, `start.sh` automatically includes `./lib` with a symlink to `/usr/lib/libada.so.4` in `LD_LIBRARY_PATH`.
- **Port already in use**:
  Ensure ports `8000` (FastAPI) and `5173` (Vite) are free:
  ```bash
  kill $(lsof -t -i:8000) 2>/dev/null || true
  kill $(lsof -t -i:5173) 2>/dev/null || true
  ```
- **Reset to Genesis**:
  Click the **"Reset Genesis"** button in the dashboard header or call `POST /api/cluster/reset`.
