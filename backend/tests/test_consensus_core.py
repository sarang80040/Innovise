import asyncio
import pytest
from backend.app.core.cluster import ClusterCoordinator
from backend.app.core.network import MessageType, NetworkSimulator
from backend.app.core.validator import LogEntry, Validator
from backend.app.schemas.models import ValidatorRole


@pytest.mark.asyncio
async def test_01_leader_election():
    """Test 1: Leader election reaches majority vote and elects exactly one leader."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    coord.network.config.jitter_ms = 1.0
    await coord.start()
    try:
        # Wait for leader to be elected
        leader_id = None
        for _ in range(50):
            if coord.current_leader_id:
                leader_id = coord.current_leader_id
                break
            await asyncio.sleep(0.1)

        assert leader_id is not None, "A leader should be elected within the election timeout"
        leader = coord.validators[leader_id]
        assert leader.role == ValidatorRole.LEADER
        assert leader.current_term >= 1
        # Exactly one leader elected in this term
        leaders = [v for v in coord.validators.values() if v.role == ValidatorRole.LEADER and v.current_term == leader.current_term]
        assert len(leaders) == 1
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_02_majority_quorum_enforcement():
    """Test 2: Majority quorum enforcement (3 of 5 needed). Stopping 3 nodes breaks quorum."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        # Wait for initial leader
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)
        assert coord.current_leader_id is not None

        # Stop 3 validators
        await coord.stop_validator("V1")
        await coord.stop_validator("V2")
        await coord.stop_validator("V3")

        status = coord.get_cluster_status()
        assert status.online_validators == 2
        assert status.quorum_active is False
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_03_transaction_commitment_with_quorum():
    """Test 3: Transaction commitment with quorum reaches COMMITTED status across validators."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        # Wait for leader
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        tx_res = await coord.submit_transaction(payload="Test transfer 50", origin="Tester")
        assert tx_res.tx_id in coord.transactions

        # Wait for quorum commit
        committed = False
        for _ in range(40):
            tx = coord.transactions[tx_res.tx_id]
            if tx.status.value == "COMMITTED":
                committed = True
                break
            await asyncio.sleep(0.1)

        assert committed, "Transaction should be committed by quorum"
        leader = coord.validators[coord.current_leader_id]
        assert leader.commit_index >= 1
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_04_failure_to_commit_without_quorum():
    """Test 4: Transactions fail or stall when quorum cannot be achieved."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        # Stop 3 followers leaving only 2 nodes online (minority)
        peers_to_stop = [vid for vid in coord.validator_ids if vid != coord.current_leader_id][:3]
        for vid in peers_to_stop:
            await coord.stop_validator(vid)

        # Submit transaction
        tx_res = await coord.submit_transaction(payload="Uncommittable tx", origin="Tester")
        # Allow time to see if it commits
        await asyncio.sleep(0.6)

        tx = coord.transactions[tx_res.tx_id]
        assert tx.status.value != "COMMITTED", "Transaction must NOT be committed when quorum is absent"
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_05_three_versus_two_partition():
    """Test 5: A 3 vs 2 partition allows Majority to commit and blocks Minority."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        leader = coord.current_leader_id
        # Define majority to include current leader
        majority = [leader]
        for v in coord.validator_ids:
            if v != leader and len(majority) < 3:
                majority.append(v)
        minority = [v for v in coord.validator_ids if v not in majority]

        await coord.partition_network(majority, minority)

        # Submit tx to majority leader
        tx_maj = await coord.submit_transaction(payload="Tx in Majority", origin="Tester")

        committed_maj = False
        for _ in range(40):
            tx = coord.transactions[tx_maj.tx_id]
            if tx.status.value == "COMMITTED":
                committed_maj = True
                break
            await asyncio.sleep(0.1)

        assert committed_maj, "Majority partition should be able to commit transactions"

        # Verify minority nodes did not commit this tx
        for vid in minority:
            assert coord.validators[vid].commit_index < coord.validators[leader].commit_index
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_06_leader_failure_and_reelection():
    """Test 6: Leader failure triggers election of a new leader."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        old_leader = coord.current_leader_id
        await coord.stop_validator(old_leader)

        new_leader = None
        for _ in range(60):
            if coord.current_leader_id and coord.current_leader_id != old_leader:
                new_leader = coord.current_leader_id
                break
            await asyncio.sleep(0.1)

        assert new_leader is not None, "A new leader should be elected after former leader crashed"
        assert new_leader != old_leader
        assert coord.validators[new_leader].role == ValidatorRole.LEADER
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_07_follower_recovery_and_synchronization():
    """Test 7: Follower catches up with committed entries after being restored."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        leader_id = coord.current_leader_id
        follower_id = [vid for vid in coord.validator_ids if vid != leader_id][0]

        # Stop follower
        await coord.stop_validator(follower_id)

        # Commit 2 transactions while follower is offline
        tx1 = await coord.submit_transaction(payload="Tx during follower downtime 1", origin="Tester")
        for _ in range(40):
            if coord.transactions[tx1.tx_id].status.value == "COMMITTED":
                break
            await asyncio.sleep(0.1)

        tx2 = await coord.submit_transaction(payload="Tx during follower downtime 2", origin="Tester")
        for _ in range(40):
            if coord.transactions[tx2.tx_id].status.value == "COMMITTED":
                break
            await asyncio.sleep(0.1)

        assert coord.validators[follower_id].commit_index < coord.validators[leader_id].commit_index

        # Restore follower
        await coord.start_validator(follower_id)

        # Allow catch up
        for _ in range(40):
            if coord.validators[follower_id].commit_index == coord.validators[leader_id].commit_index:
                break
            await asyncio.sleep(0.1)

        assert coord.validators[follower_id].commit_index == coord.validators[leader_id].commit_index, "Follower should synchronize commit index with leader"
        assert len(coord.validators[follower_id].log) == len(coord.validators[leader_id].log)
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_08_message_drops_handling():
    """Test 8: System tolerates moderate packet drops without violating consensus."""
    coord = ClusterCoordinator()
    # Configure 15% drop rate
    coord.network.config.latency_ms = 10.0
    coord.network.config.drop_rate = 0.15
    await coord.start()
    try:
        # Wait for leader
        for _ in range(60):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        assert coord.current_leader_id is not None

        tx = await coord.submit_transaction(payload="Tx under 15% packet drops", origin="Tester")
        committed = False
        for _ in range(60):
            if coord.transactions[tx.tx_id].status.value == "COMMITTED":
                committed = True
                break
            await asyncio.sleep(0.1)

        assert committed, "Transaction should eventually commit despite packet loss"
        assert coord.network.total_dropped > 0, "Network should have recorded dropped messages"
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_09_preservation_of_committed_entries_after_recovery():
    """Test 9: Committed entries are never lost or modified during crash and recovery."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        tx = await coord.submit_transaction(payload="Crucial committed payload", origin="Tester")
        for _ in range(40):
            if coord.transactions[tx.tx_id].status.value == "COMMITTED":
                break
            await asyncio.sleep(0.1)

        assert coord.transactions[tx.tx_id].status.value == "COMMITTED"
        # Allow followers to receive commit advancement before stopping leader
        await asyncio.sleep(0.3)
        old_leader = coord.current_leader_id

        # Crash leader
        await coord.stop_validator(old_leader)
        # Wait for new leader
        for _ in range(60):
            if coord.current_leader_id and coord.current_leader_id != old_leader:
                break
            await asyncio.sleep(0.1)

        # Restore crashed leader
        await coord.start_validator(old_leader)
        await asyncio.sleep(1.0)

        # Verify entry is present and committed on all online validators
        for vid, v in coord.validators.items():
            if v.is_online:
                assert any(e.tx_id == tx.tx_id and e.index <= v.commit_index for e in v.log)
    finally:
        await coord.stop()
