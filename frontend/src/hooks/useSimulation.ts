import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import {
  ClusterStatus,
  LedgerConsistency,
  SimulationEvent,
  Transaction,
  ValidatorState,
  ChartPoint,
} from '../types';

export function useSimulation() {
  const [cluster, setCluster] = useState<ClusterStatus | null>(null);
  const [validators, setValidators] = useState<ValidatorState[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [consistency, setConsistency] = useState<LedgerConsistency | null>(null);
  const [charts, setCharts] = useState<ChartPoint[]>([]);
  const [adaptiveStatus, setAdaptiveStatus] = useState<any>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Initial and periodic fetch
  const refreshAll = useCallback(async () => {
    try {
      const [c, v, txs, evs, cons, ch, ad] = await Promise.all([
        api.getCluster(),
        api.getValidators(),
        api.getTransactions(),
        api.getEvents(100),
        api.getLedgerConsistency(),
        api.getCharts(),
        api.getAdaptiveStatus(),
      ]);
      setCluster(c);
      setValidators(v);
      setTransactions(txs);
      setEvents(evs);
      setConsistency(cons);
      setCharts(ch);
      setAdaptiveStatus(ad);
    } catch (err) {
      console.error('Failed refreshing simulation state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket connection with auto-reconnect
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'CLUSTER_TICK') {
          if (data.cluster) setCluster(data.cluster);
          if (data.validators) setValidators(data.validators);
        }
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    refreshAll();
    connectWebSocket();

    // Poll for slower-changing data (transactions, charts, consistency, events)
    const interval = setInterval(async () => {
      try {
        const [txs, evs, cons, ch, ad] = await Promise.all([
          api.getTransactions(),
          api.getEvents(80),
          api.getLedgerConsistency(),
          api.getCharts(),
          api.getAdaptiveStatus(),
        ]);
        setTransactions(txs);
        setEvents(evs);
        setConsistency(cons);
        setCharts(ch);
        setAdaptiveStatus(ad);
      } catch (e) {
        // quiet error on unmount
      }
    }, 1200);

    return () => {
      clearInterval(interval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [refreshAll, connectWebSocket]);

  return {
    cluster,
    validators,
    transactions,
    events,
    consistency,
    charts,
    adaptiveStatus,
    isConnected,
    loading,
    refreshAll,
  };
}
