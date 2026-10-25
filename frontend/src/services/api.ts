import {
  ClusterStatus,
  ExperimentReport,
  LedgerConsistency,
  LogEntry,
  NetworkConfig,
  SimulationEvent,
  Transaction,
  ValidatorState,
} from '../types';

const API_BASE = '/api';

export const api = {
  async getHealth(): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getCluster(): Promise<ClusterStatus> {
    const res = await fetch(`${API_BASE}/cluster`);
    return res.json();
  },

  async resetCluster(): Promise<void> {
    await fetch(`${API_BASE}/cluster/reset`, { method: 'POST' });
  },

  async getValidators(): Promise<ValidatorState[]> {
    const res = await fetch(`${API_BASE}/validators`);
    return res.json();
  },

  async stopValidator(validatorId: string): Promise<void> {
    await fetch(`${API_BASE}/validators/${validatorId}/stop`, { method: 'POST' });
  },

  async startValidator(validatorId: string): Promise<void> {
    await fetch(`${API_BASE}/validators/${validatorId}/start`, { method: 'POST' });
  },

  async getTransactions(): Promise<Transaction[]> {
    const res = await fetch(`${API_BASE}/transactions`);
    return res.json();
  },

  async submitTransaction(payload: any, origin: string = 'Client-Dashboard'): Promise<Transaction> {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, origin }),
    });
    return res.json();
  },

  async submitBatchTransactions(count: number): Promise<{ count: number; submitted: number; transactions: Transaction[] }> {
    const res = await fetch(`${API_BASE}/transactions/batch?count=${count}`, {
      method: 'POST',
    });
    return res.json();
  },

  async updateNetworkConfig(config: NetworkConfig): Promise<void> {
    await fetch(`${API_BASE}/network/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },

  async partitionNetwork(groupA: string[], groupB: string[]): Promise<void> {
    await fetch(`${API_BASE}/network/partition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_a: groupA, group_b: groupB }),
    });
  },

  async healNetwork(): Promise<void> {
    await fetch(`${API_BASE}/network/heal`, { method: 'POST' });
  },

  async getLedgerConsistency(): Promise<LedgerConsistency> {
    const res = await fetch(`${API_BASE}/ledger/consistency`);
    return res.json();
  },

  async getValidatorLedger(validatorId: string): Promise<LogEntry[]> {
    const res = await fetch(`${API_BASE}/ledger/${validatorId}`);
    return res.json();
  },

  async getEvents(limit: number = 100): Promise<SimulationEvent[]> {
    const res = await fetch(`${API_BASE}/events?limit=${limit}`);
    return res.json();
  },

  async getCharts(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/charts`);
    return res.json();
  },

  async getAdaptiveStatus(): Promise<any> {
    const res = await fetch(`${API_BASE}/adaptive/status`);
    return res.json();
  },

  async toggleAdaptive(enabled: boolean): Promise<void> {
    await fetch(`${API_BASE}/adaptive/toggle?enabled=${enabled}`, { method: 'POST' });
  },

  async injectMalicious(validatorId: string, faultType: string, details?: any): Promise<void> {
    await fetch(`${API_BASE}/malicious/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validator_id: validatorId, fault_type: faultType, details }),
    });
  },

  async clearMalicious(validatorId: string): Promise<void> {
    await fetch(`${API_BASE}/malicious/clear?validator_id=${validatorId}`, { method: 'POST' });
  },

  async runExperiment(scenario: string): Promise<ExperimentReport> {
    const res = await fetch(`${API_BASE}/experiments/run?scenario=${scenario}`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Experiment failed');
    }
    return res.json();
  },

  async getExperimentResults(): Promise<ExperimentReport[]> {
    const res = await fetch(`${API_BASE}/experiments/results`);
    return res.json();
  },
};
