from __future__ import annotations
import asyncio
import random
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from backend.app.core.cluster import ClusterCoordinator
from backend.app.core.experiments import ExperimentRunner
from backend.app.schemas.models import (
    ClusterStatusSchema,
    LedgerConsistencySchema,
    LogEntrySchema,
    MaliciousInjectRequest,
    MetricsSummarySchema,
    NetworkConfigSchema,
    NetworkPartitionRequest,
    SimulationEventSchema,
    TransactionSchema,
    TransactionSubmitRequest,
    ValidatorStateSchema,
)

router = APIRouter(prefix="/api")

# Default singletons
coordinator: ClusterCoordinator = ClusterCoordinator()
experiment_runner: ExperimentRunner = ExperimentRunner(coordinator=coordinator)


def get_coordinator() -> ClusterCoordinator:
    return coordinator


def get_experiment_runner() -> ExperimentRunner:
    return experiment_runner


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    return {"status": "ok", "service": "blockchain-consensus-simulator"}


@router.get("/cluster", response_model=ClusterStatusSchema)
async def get_cluster_status() -> ClusterStatusSchema:
    coord = get_coordinator()
    return coord.get_cluster_status()


@router.post("/cluster/reset")
async def reset_cluster() -> Dict[str, str]:
    coord = get_coordinator()
    await coord.reset_cluster()
    return {"status": "success", "message": "Cluster reset to initial genesis state"}


@router.get("/validators", response_model=List[ValidatorStateSchema])
async def get_validators() -> List[ValidatorStateSchema]:
    coord = get_coordinator()
    return coord.get_validator_states()


@router.post("/validators/{validator_id}/stop")
async def stop_validator(validator_id: str) -> Dict[str, Any]:
    coord = get_coordinator()
    if validator_id not in coord.validators:
        raise HTTPException(status_code=404, detail=f"Validator {validator_id} not found")
    await coord.stop_validator(validator_id)
    return {"status": "success", "message": f"Validator {validator_id} stopped"}


@router.post("/validators/{validator_id}/start")
async def start_validator(validator_id: str) -> Dict[str, Any]:
    coord = get_coordinator()
    if validator_id not in coord.validators:
        raise HTTPException(status_code=404, detail=f"Validator {validator_id} not found")
    await coord.start_validator(validator_id)
    return {"status": "success", "message": f"Validator {validator_id} started"}


@router.get("/transactions", response_model=List[TransactionSchema])
async def get_transactions() -> List[TransactionSchema]:
    coord = get_coordinator()
    return coord.get_transactions()


@router.post("/transactions", response_model=TransactionSchema)
async def submit_transaction(req: TransactionSubmitRequest) -> TransactionSchema:
    coord = get_coordinator()
    return await coord.submit_transaction(payload=req.payload, origin=req.origin)


@router.post("/transactions/batch")
async def submit_transactions_batch(
    count: int = Query(default=10, ge=1, le=100, description="Number of simultaneous transactions (1-100)")
) -> Dict[str, Any]:
    """Simulates simultaneous submission of 1-100 transactions with system-generated IDs and details."""
    coord = get_coordinator()
    actions = ["TRANSFER", "DEX_SWAP", "GOVERNANCE_VOTE", "LIQUIDITY_ADD", "STAKE"]
    tokens = ["USDC", "USDT", "ETH", "BTC", "SOL", "PULSE"]

    tasks = []
    for i in range(count):
        action_type = random.choice(actions)
        if action_type == "TRANSFER":
            payload = {
                "action": "TRANSFER",
                "asset": random.choice(tokens),
                "amount": round(random.uniform(1.0, 500.0), 2),
                "recipient": f"0x{uuid.uuid4().hex[:10]}",
                "nonce": i + 1,
            }
        elif action_type == "DEX_SWAP":
            payload = {
                "action": "DEX_SWAP",
                "pair": "ETH/USDT",
                "amount_in": round(random.uniform(10.0, 1000.0), 2),
                "min_received": round(random.uniform(0.005, 0.5), 4),
                "nonce": i + 1,
            }
        elif action_type == "GOVERNANCE_VOTE":
            payload = {
                "action": "GOVERNANCE_VOTE",
                "proposal_id": random.randint(101, 199),
                "vote": random.choice(["YES", "NO", "ABSTAIN"]),
                "weight": random.randint(100, 5000),
                "nonce": i + 1,
            }
        elif action_type == "LIQUIDITY_ADD":
            payload = {
                "action": "LIQUIDITY_ADD",
                "pool": f"{random.choice(tokens)}/ETH",
                "liquidity_units": round(random.uniform(50.0, 2000.0), 2),
                "nonce": i + 1,
            }
        else:
            payload = {
                "action": "STAKE",
                "validator": f"V{random.randint(1, 5)}",
                "amount": round(random.uniform(100.0, 5000.0), 2),
                "nonce": i + 1,
            }
        tasks.append(coord.submit_transaction(payload=payload, origin=f"Simultaneous-Batch-{i+1}"))

    results = await asyncio.gather(*tasks)
    return {
        "status": "success",
        "count": count,
        "submitted": len(results),
        "transactions": [tx.model_dump() for tx in results],
    }


@router.post("/network/config")
async def update_network_config(req: NetworkConfigSchema) -> Dict[str, Any]:
    coord = get_coordinator()
    await coord.set_network_config(
        latency_ms=req.latency_ms,
        jitter_ms=req.jitter_ms,
        drop_rate=req.drop_rate,
    )
    return {"status": "success", "config": req.model_dump()}


@router.post("/network/partition")
async def create_partition(req: NetworkPartitionRequest) -> Dict[str, Any]:
    coord = get_coordinator()
    await coord.partition_network(group_a=req.group_a, group_b=req.group_b)
    return {"status": "success", "partition": req.model_dump()}


@router.post("/network/heal")
async def heal_partition() -> Dict[str, str]:
    coord = get_coordinator()
    await coord.heal_network()
    return {"status": "success", "message": "Network partition healed"}


@router.get("/ledger/consistency", response_model=LedgerConsistencySchema)
async def get_ledger_consistency() -> LedgerConsistencySchema:
    coord = get_coordinator()
    return coord.get_ledger_consistency()


@router.get("/ledger/{validator_id}", response_model=List[LogEntrySchema])
async def get_validator_ledger(validator_id: str) -> List[LogEntrySchema]:
    coord = get_coordinator()
    if validator_id not in coord.validators:
        raise HTTPException(status_code=404, detail=f"Validator {validator_id} not found")
    return coord.validators[validator_id].get_log_entries()


@router.get("/events", response_model=List[SimulationEventSchema])
async def get_events(limit: int = Query(default=100, ge=1, le=500)) -> List[SimulationEventSchema]:
    coord = get_coordinator()
    events = coord.get_events()
    return events[:limit]


@router.get("/metrics", response_model=MetricsSummarySchema)
async def get_metrics() -> MetricsSummarySchema:
    coord = get_coordinator()
    status = coord.get_cluster_status()
    return status.metrics


@router.get("/charts")
async def get_charts() -> List[Dict[str, Any]]:
    coord = get_coordinator()
    return coord.get_chart_history()


@router.get("/adaptive/status")
async def get_adaptive_status() -> Dict[str, Any]:
    coord = get_coordinator()
    return coord.adaptive.get_status()


@router.post("/adaptive/toggle")
async def toggle_adaptive(enabled: bool = Query(...)) -> Dict[str, Any]:
    coord = get_coordinator()
    coord.adaptive.config.enabled = enabled
    return {"status": "success", "adaptive_enabled": enabled}


@router.post("/malicious/inject")
async def inject_malicious(req: MaliciousInjectRequest) -> Dict[str, Any]:
    coord = get_coordinator()
    if req.validator_id not in coord.validators:
        raise HTTPException(status_code=404, detail=f"Validator {req.validator_id} not found")
    await coord.inject_malicious_behavior(
        validator_id=req.validator_id,
        fault_type=req.fault_type,
        details=req.details,
    )
    return {"status": "success", "injected": req.model_dump()}


@router.post("/malicious/clear")
async def clear_malicious(validator_id: str = Query(...)) -> Dict[str, Any]:
    coord = get_coordinator()
    if validator_id not in coord.validators:
        raise HTTPException(status_code=404, detail=f"Validator {validator_id} not found")
    await coord.clear_malicious_behavior(validator_id)
    return {"status": "success", "message": f"Cleared malicious behavior on {validator_id}"}


@router.post("/experiments/run")
async def run_experiment(scenario: str = Query(..., description="experiment_a, experiment_b, experiment_c, experiment_d, or experiment_e")) -> Dict[str, Any]:
    runner = get_experiment_runner()
    if scenario in ("experiment_a", "exp_a"):
        return await runner.run_experiment_a()
    elif scenario in ("experiment_b", "exp_b"):
        return await runner.run_experiment_b()
    elif scenario in ("experiment_c", "exp_c"):
        return await runner.run_experiment_c()
    elif scenario in ("experiment_d", "exp_d"):
        return await runner.run_experiment_d()
    elif scenario in ("experiment_e", "exp_e"):
        return await runner.run_experiment_e()
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown experiment scenario '{scenario}'. Must be one of: experiment_a, experiment_b, experiment_c, experiment_d, experiment_e.",
        )


@router.get("/experiments/results")
async def get_experiment_results() -> List[Dict[str, Any]]:
    runner = get_experiment_runner()
    return runner.results_history
