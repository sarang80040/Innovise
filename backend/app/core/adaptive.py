from __future__ import annotations
import time
from typing import Any, Callable, Dict, List, Optional
from backend.app.schemas.models import AdaptiveConfigSchema


class AdaptiveDecision:
    def __init__(
        self,
        classification: str,
        reason: str,
        prev_config: Dict[str, float],
        new_config: Dict[str, float],
        timestamp: Optional[float] = None,
    ):
        self.classification: str = classification
        self.reason: str = reason
        self.prev_config: Dict[str, float] = prev_config
        self.new_config: Dict[str, float] = new_config
        self.timestamp: float = timestamp or time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "classification": self.classification,
            "reason": self.reason,
            "prev_config": self.prev_config,
            "new_config": self.new_config,
            "timestamp": self.timestamp,
            "time_str": time.strftime("%H:%M:%S", time.localtime(self.timestamp)),
        }


class AdaptiveNetworkController:
    """Monitors simulated network health, latency, drop rates, and quorum status.
    Automatically optimizes consensus timeouts within safe, explainable bounds."""

    def __init__(
        self,
        config: Optional[AdaptiveConfigSchema] = None,
        on_decision_callback: Optional[Callable[[AdaptiveDecision], None]] = None,
    ):
        self.config: AdaptiveConfigSchema = config or AdaptiveConfigSchema()
        self.on_decision: Optional[Callable[[AdaptiveDecision], None]] = on_decision_callback

        # Current active parameters
        self.current_election_min: float = self.config.base_election_timeout_min
        self.current_election_max: float = self.config.base_election_timeout_max
        self.current_heartbeat_interval: float = self.config.base_heartbeat_interval

        self.current_classification: str = "HEALTHY"
        self.decision_history: List[AdaptiveDecision] = []
        self.last_evaluation_time: float = 0.0
        self.eval_interval: float = 1.0  # evaluate every 1.0s

    def evaluate(
        self,
        network_latency_ms: float,
        network_drop_rate: float,
        is_partitioned: bool,
        online_validators: int,
        leader_alive: bool,
    ) -> Optional[AdaptiveDecision]:
        now = time.time()
        if not self.config.enabled:
            return None

        if (now - self.last_evaluation_time) < self.eval_interval:
            return None

        self.last_evaluation_time = now

        # Determine network classification
        new_classification = "HEALTHY"
        if not leader_alive or online_validators < 3:
            new_classification = "QUORUM_LOST"
        elif is_partitioned:
            new_classification = "PARTITIONED"
        elif network_drop_rate >= 0.20 or network_latency_ms >= 300:
            new_classification = "SEVERELY_DEGRADED"
        elif network_drop_rate >= 0.08:
            new_classification = "HIGH_LOSS"
        elif network_latency_ms >= 100:
            new_classification = "HIGH_LATENCY"

        # Determine target parameters based on classification
        target_min = self.config.base_election_timeout_min
        target_max = self.config.base_election_timeout_max
        target_hb = self.config.base_heartbeat_interval
        reason = ""

        if new_classification == "SEVERELY_DEGRADED":
            target_hb = 0.8
            target_min = 3.5
            target_max = 5.5
            reason = (
                f"Severe network degradation detected (latency {network_latency_ms:.0f}ms, drops {int(network_drop_rate * 100)}%). "
                f"Extended election timeout to {target_min}s-{target_max}s to prevent cascading election storms and split-votes."
            )
        elif new_classification == "HIGH_LOSS":
            target_hb = 0.6
            target_min = 2.5
            target_max = 4.2
            reason = (
                f"Elevated packet loss ({int(network_drop_rate * 100)}%) detected. "
                f"Increased election timeout to {target_min}s-{target_max}s to accommodate dropped heartbeats without unnecessary elections."
            )
        elif new_classification == "HIGH_LATENCY":
            target_hb = 0.6
            target_min = 2.2
            target_max = 3.8
            reason = (
                f"High network latency ({network_latency_ms:.0f}ms) detected. "
                f"Scaled election timeout bounds to {target_min}s-{target_max}s to allow round-trip heartbeats to arrive."
            )
        elif new_classification == "PARTITIONED":
            target_hb = 0.5
            target_min = 2.0
            target_max = 3.5
            reason = "Network partition active. Stabilizing timeouts; minority partition will suspend commits while majority maintains progress."
        elif new_classification == "QUORUM_LOST":
            target_hb = 0.5
            target_min = 1.8
            target_max = 3.2
            reason = "Quorum currently unavailable. Transactions suspended; maintaining responsive timeouts for fast election when nodes reconnect."
        else:
            # HEALTHY
            target_hb = self.config.base_heartbeat_interval
            target_min = self.config.base_election_timeout_min
            target_max = self.config.base_election_timeout_max
            if self.current_classification != "HEALTHY":
                reason = "Network conditions returned to normal. Restored optimal baseline timeouts (1.5s-3.0s) for rapid failure detection."

        # Check if changed
        changed = (
            new_classification != self.current_classification
            or abs(target_min - self.current_election_min) > 0.05
            or abs(target_max - self.current_election_max) > 0.05
            or abs(target_hb - self.current_heartbeat_interval) > 0.05
        )

        if changed and reason:
            prev_cfg = {
                "election_min": self.current_election_min,
                "election_max": self.current_election_max,
                "heartbeat_interval": self.current_heartbeat_interval,
            }
            new_cfg = {
                "election_min": target_min,
                "election_max": target_max,
                "heartbeat_interval": target_hb,
            }

            self.current_classification = new_classification
            self.current_election_min = target_min
            self.current_election_max = target_max
            self.current_heartbeat_interval = target_hb

            decision = AdaptiveDecision(
                classification=new_classification,
                reason=reason,
                prev_config=prev_cfg,
                new_config=new_cfg,
            )
            self.decision_history.append(decision)
            if len(self.decision_history) > 50:
                self.decision_history.pop(0)

            if self.on_decision:
                self.on_decision(decision)

            return decision

        return None

    def get_status(self) -> Dict[str, Any]:
        return {
            "enabled": self.config.enabled,
            "current_classification": self.current_classification,
            "current_timeouts": {
                "election_min_sec": self.current_election_min,
                "election_max_sec": self.current_election_max,
                "heartbeat_interval_sec": self.current_heartbeat_interval,
            },
            "recent_decisions": [d.to_dict() for d in reversed(self.decision_history[-10:])],
        }
