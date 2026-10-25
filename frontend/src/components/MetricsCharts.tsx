import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Brush,
} from 'recharts';
import {
  Activity,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  PackageX,
  Users,
  FastForward,
  RotateCcw,
  History,
  MoveHorizontal,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Sliders,
} from 'lucide-react';
import { ChartPoint, MetricsSummary } from '../types';

interface MetricsChartsProps {
  metrics: MetricsSummary | null;
  charts: ChartPoint[];
}

export const MetricsCharts: React.FC<MetricsChartsProps> = ({ metrics, charts }) => {
  const [activeMetric, setActiveMetric] = useState<'tps' | 'latency' | 'nodes' | 'drops'>('tps');
  
  // View mode: 'scroll' (horizontal scrollable canvas) vs 'fit' (fits width with scrubber slider & brush)
  const [viewMode, setViewMode] = useState<'scroll' | 'fit'>('scroll');
  
  // Time window preset: seconds to display
  const [windowPreset, setWindowPreset] = useState<number | 'all'>('all');
  
  // Offset in points from latest (for fit mode scrubber): 0 = live
  const [offsetFromEnd, setOffsetFromEnd] = useState<number>(0);
  
  // Whether the view is actively locked to live stream
  const [isLive, setIsLive] = useState<boolean>(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filtered dataset based on windowPreset and offset (for fit mode or when limiting data)
  const displayData = useMemo(() => {
    if (!charts || charts.length === 0) return [];
    
    if (viewMode === 'scroll') {
      if (windowPreset === 'all') return charts;
      const sliceSize = typeof windowPreset === 'number' ? windowPreset : charts.length;
      return charts.slice(Math.max(0, charts.length - sliceSize));
    }

    // In 'fit' mode, slice according to windowPreset and offsetFromEnd
    const total = charts.length;
    const windowSize = windowPreset === 'all' ? total : Math.min(windowPreset, total);
    const endIdx = Math.max(windowSize, total - offsetFromEnd);
    const startIdx = Math.max(0, endIdx - windowSize);
    return charts.slice(startIdx, endIdx);
  }, [charts, viewMode, windowPreset, offsetFromEnd]);

  // Dynamic canvas width for scrollable mode (allows scrolling through past points)
  const scrollCanvasWidth = useMemo(() => {
    const pointCount = displayData.length;
    // 16px per data point, minimum 700px
    return Math.max(700, pointCount * 16);
  }, [displayData.length]);

  // Keep scrollbar pinned to the latest data when in live mode
  useEffect(() => {
    if (viewMode === 'scroll' && isLive && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [charts.length, viewMode, isLive]);

  // Detect when user scrolls manually
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    // If within 30px of the right end, consider it live
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 30;
    if (isLive !== isAtEnd) {
      setIsLive(isAtEnd);
    }
  }, [isLive]);

  // Mouse wheel horizontal scrolling
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (viewMode === 'scroll' && scrollContainerRef.current) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        scrollContainerRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  // Jump to live latest point
  const jumpToLive = useCallback(() => {
    setIsLive(true);
    setOffsetFromEnd(0);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, []);

  // Step backwards or forwards in time
  const stepTime = (seconds: number) => {
    if (viewMode === 'scroll' && scrollContainerRef.current) {
      setIsLive(false);
      scrollContainerRef.current.scrollBy({
        left: seconds * 16,
        behavior: 'smooth',
      });
    } else {
      setIsLive(false);
      setOffsetFromEnd((prev) => {
        const maxOffset = Math.max(0, charts.length - 15);
        return Math.min(maxOffset, Math.max(0, prev - seconds));
      });
    }
  };

  // Max offset for scrubber in fit mode
  const maxOffset = Math.max(0, charts.length - (typeof windowPreset === 'number' ? windowPreset : 15));

  const metricDataKey = useMemo(() => {
    if (activeMetric === 'tps') return 'throughput';
    if (activeMetric === 'latency') return 'latency_ms';
    if (activeMetric === 'nodes') return 'online_validators';
    return 'message_drops';
  }, [activeMetric]);

  const yUnit = useMemo(() => {
    if (activeMetric === 'tps') return ' tps';
    if (activeMetric === 'latency') return ' ms';
    if (activeMetric === 'drops') return ' pkts';
    return '';
  }, [activeMetric]);

  const metricName = useMemo(() => {
    if (activeMetric === 'tps') return 'Throughput (TPS)';
    if (activeMetric === 'latency') return 'Confirmation Latency (ms)';
    if (activeMetric === 'nodes') return 'Online Validators';
    return 'Total Dropped Messages';
  }, [activeMetric]);

  const metricStroke = useMemo(() => {
    if (activeMetric === 'tps') return '#06b6d4';
    if (activeMetric === 'latency') return '#10b981';
    if (activeMetric === 'nodes') return '#8b5cf6';
    return '#f43f5e';
  }, [activeMetric]);

  // Determine non-zero, robust Y-axis domain so ticks are always visible across all metrics and timeframes
  const calculatedDomain = useMemo((): [number, number] => {
    if (activeMetric === 'nodes') return [0, 5];

    const sourceData = displayData.length > 0 ? displayData : charts;
    const values = sourceData
      .map((d) => Number(d[metricDataKey]))
      .filter((v) => !isNaN(v) && v !== null);

    const maxVal = values.length > 0 ? Math.max(...values) : 0;

    if (activeMetric === 'tps') {
      if (maxVal <= 0) return [0, 10];
      return [0, Math.max(10, Math.ceil(maxVal * 1.25))];
    }

    if (activeMetric === 'latency') {
      if (maxVal <= 0) return [0, 500];
      const rounded = Math.ceil((maxVal * 1.2) / 100) * 100;
      return [0, Math.max(500, rounded)];
    }

    if (activeMetric === 'drops') {
      if (maxVal <= 0) return [0, 50];
      const rounded = Math.ceil((maxVal * 1.2) / 50) * 50;
      return [0, Math.max(50, rounded)];
    }

    return [0, 10];
  }, [displayData, charts, activeMetric, metricDataKey]);

  // Synthetic 2-point boundary data matching calculated domain to ensure Recharts always generates ticks
  const axisAnchorData = useMemo(() => [
    { [metricDataKey]: calculatedDomain[0] },
    { [metricDataKey]: calculatedDomain[1] }
  ], [calculatedDomain, metricDataKey]);

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
        <div className="flex flex-wrap bg-dark-900 p-1 rounded-lg border border-dark-700 text-xs gap-1">
          <button
            onClick={() => setActiveMetric('tps')}
            className={`px-3 py-1 rounded-md font-medium transition-all whitespace-normal break-words leading-tight ${
              activeMetric === 'tps'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Throughput (TPS)
          </button>
          <button
            onClick={() => setActiveMetric('latency')}
            className={`px-3 py-1 rounded-md font-medium transition-all whitespace-normal break-words leading-tight ${
              activeMetric === 'latency'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Confirmation Latency
          </button>
          <button
            onClick={() => setActiveMetric('nodes')}
            className={`px-3 py-1 rounded-md font-medium transition-all whitespace-normal break-words leading-tight ${
              activeMetric === 'nodes'
                ? 'bg-brand-blue text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Quorum & Online Nodes
          </button>
          <button
            onClick={() => setActiveMetric('drops')}
            className={`px-3 py-1 rounded-md font-medium transition-all whitespace-normal break-words leading-tight ${
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
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block whitespace-normal break-words leading-tight">
            Throughput
          </span>
          <div className="text-lg font-bold font-mono text-cyan-400 my-0.5 whitespace-normal break-words leading-tight flex items-baseline flex-wrap gap-1">
            <span>{metrics?.throughput_tps ?? 0}</span>
            <span className="text-[10px] font-sans text-slate-500 font-normal">tps</span>
          </div>
          <span className="text-[10px] text-slate-500 whitespace-normal break-words leading-tight">
            10s sliding window
          </span>
        </div>

        {/* Confirmation Latency */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block whitespace-normal break-words leading-tight">
            Avg Latency
          </span>
          <div className="text-lg font-bold font-mono text-emerald-400 my-0.5 whitespace-normal break-words leading-tight flex items-baseline flex-wrap gap-1">
            <span>
              {metrics?.avg_latency_ms !== null && metrics?.avg_latency_ms !== undefined
                ? metrics.avg_latency_ms
                : 'N/A'}
            </span>
            {metrics?.avg_latency_ms !== null && metrics?.avg_latency_ms !== undefined && (
              <span className="text-[10px] font-sans text-slate-500 font-normal">ms</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 whitespace-normal break-words leading-tight">
            p95: {metrics?.p95_latency_ms ? `${metrics.p95_latency_ms} ms` : 'N/A'}
          </span>
        </div>

        {/* Committed / Submitted */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block whitespace-normal break-words leading-tight">
            Tx Commitment
          </span>
          <div className="text-lg font-bold font-mono text-purple-400 my-0.5 whitespace-normal break-words leading-tight flex items-baseline flex-wrap gap-1">
            <span>{metrics?.total_committed ?? 0}</span>
            <span className="text-xs text-slate-500 font-normal">/ {metrics?.total_submitted ?? 0}</span>
          </div>
          <span className="text-[10px] text-slate-500 whitespace-normal break-words leading-tight">
            Pending: {metrics?.total_pending ?? 0}
          </span>
        </div>

        {/* Packet Drops */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block whitespace-normal break-words leading-tight">
            Message Drops
          </span>
          <div className="text-lg font-bold font-mono text-rose-400 my-0.5 whitespace-normal break-words leading-tight">
            {metrics?.total_messages_dropped ?? 0}
          </div>
          <span className="text-[10px] text-slate-500 whitespace-normal break-words leading-tight">
            Drop rate: {((metrics?.message_drop_rate ?? 0) * 100).toFixed(1)}%
          </span>
        </div>

        {/* Recovery Duration */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block whitespace-normal break-words leading-tight">
            Last Recovery Time
          </span>
          <div className="text-lg font-bold font-mono text-amber-400 my-0.5 whitespace-normal break-words leading-tight flex items-baseline flex-wrap gap-1">
            <span>
              {metrics?.recovery_time_last_sec !== null && metrics?.recovery_time_last_sec !== undefined
                ? metrics.recovery_time_last_sec
                : 'Nominal'}
            </span>
            {metrics?.recovery_time_last_sec !== null && metrics?.recovery_time_last_sec !== undefined && (
              <span className="text-[10px] font-sans text-slate-500 font-normal">sec</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 whitespace-normal break-words leading-tight">
            Failover / healing sync
          </span>
        </div>

        {/* Consistency Score */}
        <div className="p-3 rounded-lg bg-dark-900/70 border border-dark-700 min-w-0 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-semibold uppercase block whitespace-normal break-words leading-tight">
            Ledger Consistency
          </span>
          <div className="text-lg font-bold font-mono text-emerald-400 my-0.5 whitespace-normal break-words leading-tight">
            {metrics?.consistency_percentage ?? 100}%
          </div>
          <span className="text-[10px] text-slate-500 whitespace-normal break-words leading-tight">
            Prefix match verified
          </span>
        </div>
      </div>

      {/* History & Scroll Navigation Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-dark-900/90 border border-dark-700 rounded-lg p-2.5 text-xs">
        {/* Left: View Mode Toggle & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switch: Scrollable Canvas vs Fit Scrubber */}
          <div className="flex bg-dark-800 p-0.5 rounded border border-dark-700">
            <button
              onClick={() => setViewMode('scroll')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'scroll'
                  ? 'bg-brand-blue text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Horizontally scrollable canvas: swipe or use mouse wheel to pan back in time"
            >
              <MoveHorizontal className="w-3.5 h-3.5" />
              Scrollable Canvas
            </button>
            <button
              onClick={() => setViewMode('fit')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'fit'
                  ? 'bg-brand-blue text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Fit to card width with timeline scrubber slider and brush"
            >
              <Sliders className="w-3.5 h-3.5" />
              Fit + Scrubber
            </button>
          </div>

          <div className="h-4 w-px bg-dark-700 hidden sm:block" />

          {/* Time Window Presets */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 text-[10px] font-semibold uppercase hidden md:inline">Span:</span>
            {(['all', 300, 180, 60, 30] as const).map((preset) => {
              const label =
                preset === 'all'
                  ? `All (${charts.length}s)`
                  : preset >= 60
                  ? `${preset / 60}m`
                  : `${preset}s`;
              const isSelected = windowPreset === preset;
              return (
                <button
                  key={String(preset)}
                  onClick={() => setWindowPreset(preset)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                    isSelected
                      ? 'bg-slate-700 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Step Navigation & Live Status */}
        <div className="flex items-center gap-2">
          {/* Step Back & Forward Buttons */}
          <div className="flex items-center gap-1 bg-dark-800 rounded border border-dark-700 p-0.5">
            <button
              onClick={() => stepTime(-60)}
              className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-dark-700 rounded transition-colors"
              title="Step back 1 minute into past"
            >
              -1m
            </button>
            <button
              onClick={() => stepTime(-15)}
              className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-dark-700 rounded flex items-center transition-colors"
              title="Step back 15 seconds"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              -15s
            </button>
            <button
              onClick={() => stepTime(15)}
              className="px-1.5 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-dark-700 rounded flex items-center transition-colors"
              title="Step forward 15 seconds"
            >
              +15s
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Live / Historical Status Pill */}
          {isLive ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-600/40 text-emerald-400 text-[11px] font-semibold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              LIVE
            </div>
          ) : (
            <button
              onClick={jumpToLive}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 hover:bg-amber-900 text-[11px] font-bold shadow-md transition-all group"
              title="Click to jump back to real-time live data"
            >
              <History className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-180 transition-transform" />
              <span>PAST VIEW</span>
              <span className="bg-amber-500/30 px-1 rounded text-[10px] text-amber-200 flex items-center gap-0.5">
                <FastForward className="w-2.5 h-2.5" />
                Live
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Scrubber slider for Fit mode */}
      {viewMode === 'fit' && maxOffset > 0 && (
        <div className="flex items-center gap-3 px-2 py-1 bg-dark-900/60 rounded border border-dark-800 text-[11px] text-slate-400">
          <span className="text-slate-500 flex items-center gap-1 whitespace-nowrap">
            <Clock className="w-3 h-3 text-cyan-400" />
            History Scrubber:
          </span>
          <span className="text-[10px] font-mono text-slate-500">{charts[0]?.timestamp}</span>
          <input
            type="range"
            min={0}
            max={maxOffset}
            value={offsetFromEnd}
            onChange={(e) => {
              const val = Number(e.target.value);
              setOffsetFromEnd(val);
              setIsLive(val === 0);
            }}
            className="flex-1 accent-cyan-500 cursor-pointer h-1.5 bg-dark-700 rounded-lg"
          />
          <span className="text-[10px] font-mono text-cyan-400 font-bold">
            {charts[charts.length - 1]?.timestamp} (Live)
          </span>
          {offsetFromEnd > 0 && (
            <button
              onClick={jumpToLive}
              className="px-2 py-0.5 rounded bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 text-[10px] font-semibold border border-cyan-700 flex items-center gap-1 transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      )}

      {/* Timestamp Range & Scroll Helper Hint */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <div className="flex items-center gap-1.5 font-mono">
          <span>Window:</span>
          <span className="text-slate-300">
            {displayData.length > 0 ? `${displayData[0]?.timestamp} → ${displayData[displayData.length - 1]?.timestamp}` : 'Awaiting telemetry...'}
          </span>
          <span>•</span>
          <span>{displayData.length} sec points</span>
          <span>(total {charts.length}s in memory)</span>
        </div>

        {viewMode === 'scroll' && (
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400">
            <MoveHorizontal className="w-3 h-3 text-cyan-400" />
            <span>Swipe or use mouse wheel to scroll through past timeline</span>
          </div>
        )}
      </div>

      {/* Chart Canvas Area */}
      <div className="h-72 w-full pt-1 relative">
        {viewMode === 'scroll' ? (
          /* Scrollable Mode: Fixed Y-Axis on Left + Horizontally Scrollable Chart on Right */
          <div className="flex w-full h-full border border-dark-700/60 rounded-lg overflow-hidden bg-dark-900/40">
            {/* Fixed Y-Axis column (Sticky on the left, does not scroll) */}
            <div className="w-20 sm:w-24 flex-shrink-0 h-full border-r border-dark-800 bg-dark-900/95 z-10 pt-1 pb-4 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={axisAnchorData}
                  margin={{ top: 10, right: 6, left: 2, bottom: 20 }}
                >
                  <YAxis
                    domain={calculatedDomain}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={true}
                    axisLine={{ stroke: '#475569', strokeWidth: 1.5 }}
                    tick={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 500 }}
                    width={66}
                    tickFormatter={(val) => `${val}${yUnit}`}
                  />
                  <Line
                    type="monotone"
                    dataKey={metricDataKey}
                    stroke="transparent"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Scrollable Timeline Chart Area */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              onWheel={handleWheel}
              className="flex-1 overflow-x-auto overflow-y-hidden h-full scroll-smooth"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#334155 #0b0f19',
              }}
            >
              <div
                style={{
                  width: `${scrollCanvasWidth}px`,
                  minWidth: '100%',
                  height: '100%',
                }}
                className="pt-1 pb-2 pr-4"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={displayData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="timestamp"
                      stroke="#94a3b8"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: '#334155' }}
                      minTickGap={25}
                    />
                    <YAxis
                      hide
                      domain={calculatedDomain}
                    />
                    {activeMetric === 'nodes' && (
                      <ReferenceLine
                        y={3}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        label={{
                          value: 'Quorum (3)',
                          fill: '#f59e0b',
                          fontSize: 10,
                          position: 'top',
                        }}
                      />
                    )}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      }}
                      labelFormatter={(label) => `Time: ${label}`}
                      formatter={(val: any) => [`${val}${yUnit}`, metricName]}
                    />
                    <Line
                      type={activeMetric === 'nodes' ? 'stepAfter' : 'monotone'}
                      dataKey={metricDataKey}
                      stroke={metricStroke}
                      strokeWidth={2}
                      dot={false}
                      name={metricName}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Floating Jump to Live Pill when scrolled back in time */}
            {!isLive && (
              <button
                onClick={jumpToLive}
                className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-xl border border-cyan-400 transition-all hover:scale-105 animate-bounce"
              >
                <FastForward className="w-3.5 h-3.5" />
                Jump to Live
              </button>
            )}
          </div>
        ) : (
          /* Fit Mode: Responsive Full-Width Chart with Interactive Recharts Brush */
          <div className="w-full h-full border border-dark-700/60 rounded-lg p-2 bg-dark-900/40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                margin={{ top: 10, right: 15, left: 8, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  domain={calculatedDomain}
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={true}
                  axisLine={{ stroke: '#475569', strokeWidth: 1.5 }}
                  tick={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 500 }}
                  width={70}
                  tickFormatter={(val) => `${val}${yUnit}`}
                />
                {activeMetric === 'nodes' && (
                  <ReferenceLine
                    y={3}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{
                      value: 'Quorum Threshold (3)',
                      fill: '#f59e0b',
                      fontSize: 10,
                    }}
                  />
                )}
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}
                  labelFormatter={(label) => `Time: ${label}`}
                  formatter={(val: any) => [`${val}${yUnit}`, metricName]}
                />
                <Line
                  type={activeMetric === 'nodes' ? 'stepAfter' : 'monotone'}
                  dataKey={metricDataKey}
                  stroke={metricStroke}
                  strokeWidth={2}
                  dot={false}
                  name={metricName}
                  isAnimationActive={false}
                />
                {displayData.length > 3 && (
                  <Brush
                    dataKey="timestamp"
                    height={24}
                    stroke={metricStroke}
                    fill="#0b0f19"
                    travellerWidth={8}
                    tickFormatter={(val) => val}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
