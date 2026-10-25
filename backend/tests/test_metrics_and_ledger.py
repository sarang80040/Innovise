import asyncio
import time
import pytest
from backend.app.core.cluster import ClusterCoordinator
from backend.app.core.metrics import MetricsTracker
from backend.app.core.validator import LogEntry, Validator


def test_10_committed_prefix_consistency_calculation():
    """Test 10: Accurate calculation of committed prefixes and detection of safety violations."""
    metrics = MetricsTracker()
    v1 = Validator("V1", ["V2", "V3", "V4", "V5"])
    v2 = Validator("V2", ["V1", "V3", "V4", "V5"])
    v3 = Validator("V3", ["V1", "V2", "V4", "V5"])
    v4 = Validator("V4", ["V1", "V2", "V3", "V5"])
    v5 = Validator("V5", ["V1", "V2", "V3", "V4"])

    validators = {"V1": v1, "V2": v2, "V3": v3, "V4": v4, "V5": v5}

    # All share matching committed entry at index 1
    for v in validators.values():
        v.log.append(LogEntry(index=1, term=1, tx_id="tx-1", payload="valid"))
        v.commit_index = 1

    consistency = metrics.check_ledger_consistency(validators, leader_id="V1")
    assert consistency.is_consistent is True
    assert consistency.safety_violation is False
    assert consistency.synchronized_count == 5

    # Introduce safety violation on V5 (conflicting committed entry at index 1)
    v5.log[0] = LogEntry(index=1, term=2, tx_id="tx-conflict", payload="malicious")
    bad_consistency = metrics.check_ledger_consistency(validators, leader_id="V1")
    assert bad_consistency.safety_violation is True
    assert len(bad_consistency.conflicts) > 0


def test_11_accurate_throughput_calculation():
    """Test 11: Accurate throughput calculation over sliding window."""
    metrics = MetricsTracker(window_seconds=2.0)
    now = time.time()
    # Record 4 commits at current time
    for _ in range(4):
        metrics.committed_tx_timestamps.append(now)

    tps = metrics.calculate_throughput(now=now)
    assert tps == 2.0  # 4 commits in 2.0s window = 2.0 tps


def test_12_accurate_confirmation_latency_calculation():
    """Test 12: Accurate confirmation latency calculation (avg and p95)."""
    metrics = MetricsTracker()
    # Add known latencies
    latencies = [10.0, 20.0, 30.0, 40.0, 100.0]
    for lat in latencies:
        metrics.record_committed_tx(lat)

    avg, p95 = metrics.calculate_latencies()
    assert avg == 40.0
    assert p95 == 100.0


def test_13_accurate_recovery_time_calculation():
    """Test 13: Accurate measurement of failure duration and recovery."""
    metrics = MetricsTracker()
    metrics.start_failure_measurement("leader_failure")
    time.sleep(0.1)
    duration = metrics.finish_recovery_measurement("leader_failure")
    assert duration is not None
    assert duration >= 0.09
    assert metrics.last_recovery_time_sec == duration


@pytest.mark.asyncio
async def test_14_network_healing_and_reconciliation():
    """Test 14: Network healing restores communication and synchronizes lagging nodes."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        # Wait for leader
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        # Partition into [V1, V2, V3] and [V4, V5]
        await coord.partition_network(["V1", "V2", "V3"], ["V4", "V5"])
        assert coord.network.partitions is not None

        # Heal network
        await coord.heal_network()
        assert coord.network.partitions is None
        for v in coord.validators.values():
            assert v.partition_id is None

        # Give leader time to synchronize all nodes
        await asyncio.sleep(0.5)
        consistency = coord.get_ledger_consistency()
        assert consistency.is_consistent is True
    finally:
        await coord.stop()
