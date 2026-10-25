import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  PackageX,
  Users,
} from 'lucide-react';
import { ChartPoint, MetricsSummary } from '../types';

interface MetricsChartsProps {
  metrics: MetricsSummary | null;
  charts: ChartPoint[];
}

export const MetricsCharts: React.FC<MetricsChartsProps> = ({ metrics, charts }) => {
  const [activeMetric, setActiveMetric] = useState<'tps' | 'latency' | 'nodes' | 'drops'>('tps');

  return (
    <div className="bg-dark-800/80 border border-dark-700 rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-4">
      {/* Title & Metric selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-blue" />
            Consensus Telemetry & Performance Analytics
          </h2>
          <p className="text-xs text-slate-400">
            Real-time measurements of cluster throughput, confirmation latencies, and packet delivery.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-dark-900 p-1 rounded-lg border border-dark-700 text-xs">
          <button
            onClick={() => setActiveMetric('tps')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeMetric === 'tps'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Throughput (TPS)
          </button>
          <button
            onClick={() => setActiveMetric('latency')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeMetric === 'latency'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Confirmation Latency
          </button>
          <button
            onClick={() => setActiveMetric('nodes')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeMetric === 'nodes'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Quorum & Online Nodes
          </button>
          <button
            onClick={() => setActiveMetric('drops')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              activeMetric === 'drops'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Packet Drops
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Throughput */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Throughput</span>
          <div className="text-lg font-bold font-mono text-cyan-400 my-0.5">
            {metrics?.throughput_tps ?? 0}{' '}
            <span className="text-[10px] font-sans text-slate-500 font-normal">tps</span>
          </div>
          <span className="text-[10px] text-slate-500">10s sliding window</span>
        </div>

        {/* Confirmation Latency */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Avg Latency</span>
          <div className="text-lg font-bold font-mono text-emerald-400 my-0.5">
            {metrics?.avg_latency_ms !== null && metrics?.avg_latency_ms !== undefined
              ? `${metrics.avg_latency_ms} ms`
              : 'N/A'}
          </div>
          <span className="text-[10px] text-slate-500">
            p95: {metrics?.p95_latency_ms ? `${metrics.p95_latency_ms}ms` : 'N/A'}
          </span>
        </div>

        {/* Committed / Submitted */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Tx Commitment</span>
          <div className="text-lg font-bold font-mono text-purple-400 my-0.5">
            {metrics?.total_committed ?? 0}
            <span className="text-xs text-slate-500 font-normal"> / {metrics?.total_submitted ?? 0}</span>
          </div>
          <span className="text-[10px] text-slate-500">
            Pending: {metrics?.total_pending ?? 0}
          </span>
        </div>

        {/* Packet Drops */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Message Drops</span>
          <div className="text-lg font-bold font-mono text-rose-400 my-0.5">
            {metrics?.total_messages_dropped ?? 0}
          </div>
          <span className="text-[10px] text-slate-500">
            Drop rate: {((metrics?.message_drop_rate ?? 0) * 100).toFixed(1)}%
          </span>
        </div>

        {/* Recovery Duration */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Last Recovery Time</span>
          <div className="text-lg font-bold font-mono text-amber-400 my-0.5">
            {metrics?.recovery_time_last_sec !== null && metrics?.recovery_time_last_sec !== undefined
              ? `${metrics.recovery_time_last_sec} s`
              : 'Nominal'}
          </div>
          <span className="text-[10px] text-slate-500">Failover / healing sync</span>
        </div>

        {/* Consistency Score */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block">Ledger Consistency</span>
          <div className="text-lg font-bold font-mono text-emerald-400 my-0.5">
            {metrics?.consistency_percentage ?? 100}%
          </div>
          <span className="text-[10px] text-slate-500">Prefix match verified</span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-60 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeMetric === 'tps' ? (
            <LineChart data={charts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} unit=" tps" />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="throughput"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
                name="Throughput (TPS)"
              />
            </LineChart>
          ) : activeMetric === 'latency' ? (
            <LineChart data={charts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} unit=" ms" />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="latency_ms"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Confirmation Latency (ms)"
              />
            </LineChart>
          ) : activeMetric === 'nodes' ? (
            <LineChart data={charts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} domain={[0, 5]} />
              <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Quorum Threshold (3)', fill: '#f59e0b', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
              />
              <Line
                type="stepAfter"
                dataKey="online_validators"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                name="Online Validators"
              />
            </LineChart>
          ) : (
            <LineChart data={charts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={11} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="message_drops"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={false}
                name="Total Dropped Messages"
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
