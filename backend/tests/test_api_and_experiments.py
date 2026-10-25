import asyncio
import json
import pytest
from httpx import ASGITransport, AsyncClient
from backend.app.api.websocket import ws_manager
from backend.app.core.cluster import ClusterCoordinator
from backend.app.core.experiments import ExperimentRunner
from backend.app.main import app


@pytest.mark.asyncio
async def test_15_malicious_fault_injection():
    """Test 15: Malicious fault injection records fault event and sets validator state."""
    coord = ClusterCoordinator()
    await coord.start()
    try:
        await coord.inject_malicious_behavior(
            validator_id="V5",
            fault_type="fabricate_ack",
            details={"note": "Fake ack fault"},
        )
        assert coord.validators["V5"].is_malicious is True
        assert coord.validators["V5"].malicious_type == "fabricate_ack"

        # Check recorded event
        fault_events = [ev for ev in coord.events if ev.category.value == "MALICIOUS"]
        assert len(fault_events) > 0
        assert "fabricate_ack" in fault_events[-1].message

        # Clear malicious behavior
        await coord.clear_malicious_behavior("V5")
        assert coord.validators["V5"].is_malicious is False
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_16_cluster_reset():
    """Test 16: Cluster reset restores clean genesis state."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        # Submit transaction
        for _ in range(40):
            if coord.current_leader_id:
                break
            await asyncio.sleep(0.1)

        await coord.submit_transaction(payload="Tx before reset", origin="Tester")
        assert len(coord.transactions) > 0

        # Reset
        await coord.reset_cluster()
        assert len(coord.transactions) == 0
        assert len(coord.tx_order) == 0
        assert coord.network.total_sent == 0
        assert coord.current_leader_id is None
        for v in coord.validators.values():
            assert v.commit_index == 0
            assert len(v.log) == 0
            assert v.is_online is True
    finally:
        await coord.stop()


@pytest.mark.asyncio
async def test_17_websocket_broadcast():
    """Test 17: WebSocket broadcast delivers live cluster ticks and state updates."""
    delivered_payloads = []

    class MockWebSocket:
        async def accept(self):
            pass

        async def send_text(self, text: str):
            delivered_payloads.append(json.loads(text))

    mock_ws = MockWebSocket()
    await ws_manager.connect(mock_ws)

    coord = ClusterCoordinator()
    coord.register_broadcast_callback(ws_manager.broadcast)
    await coord.start()
    try:
        # Wait a few ticks
        await asyncio.sleep(0.2)
        assert len(delivered_payloads) > 0
        msg = delivered_payloads[-1]
        assert msg["type"] == "CLUSTER_TICK"
        assert "cluster" in msg
        assert "validators" in msg
    finally:
        await coord.stop()
        ws_manager.disconnect(mock_ws)


@pytest.mark.asyncio
async def test_18_rest_api_endpoints():
    """Test 18: Full REST API coverage."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Health
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # Cluster
        res = await client.get("/api/cluster")
        assert res.status_code == 200
        data = res.json()
        assert data["total_validators"] == 5

        # Validators
        res = await client.get("/api/validators")
        assert res.status_code == 200
        vals = res.json()
        assert len(vals) == 5

        # Network config
        res = await client.post("/api/network/config", json={"latency_ms": 50.0, "jitter_ms": 10.0, "drop_rate": 0.05})
        assert res.status_code == 200

        # Stop validator
        res = await client.post("/api/validators/V5/stop")
        assert res.status_code == 200
        res = await client.post("/api/validators/V5/start")
        assert res.status_code == 200

        # Partition & Heal
        res = await client.post("/api/network/partition", json={"group_a": ["V1", "V2", "V3"], "group_b": ["V4", "V5"]})
        assert res.status_code == 200
        res = await client.post("/api/network/heal")
        assert res.status_code == 200

        # Adaptive toggle
        res = await client.post("/api/adaptive/toggle?enabled=true")
        assert res.status_code == 200
        res = await client.get("/api/adaptive/status")
        assert res.status_code == 200

        # Events
        res = await client.get("/api/events")
        assert res.status_code == 200

        # Metrics & Charts
        res = await client.get("/api/metrics")
        assert res.status_code == 200
        res = await client.get("/api/charts")
        assert res.status_code == 200


@pytest.mark.asyncio
async def test_19_experiment_runner():
    """Test 19: Experiment runner executes Experiment A and generates JSON report."""
    coord = ClusterCoordinator()
    coord.network.config.latency_ms = 5.0
    await coord.start()
    try:
        runner = ExperimentRunner(coordinator=coord)
        report = await runner.run_experiment_a()
        assert report["experiment_id"] == "exp-a-normal"
        assert report["submitted_count"] == 5
        assert report["committed_count"] == 5
        assert report["is_consistent"] is True
        assert len(runner.results_history) == 1
    finally:
        await coord.stop()
