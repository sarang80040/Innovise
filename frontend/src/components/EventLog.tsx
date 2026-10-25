import React, { useState } from 'react';
import {
  Terminal,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Flame,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { EventCategory, EventSeverity, SimulationEvent } from '../types';

interface EventLogProps {
  events: SimulationEvent[];
}

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [frozenEvents, setFrozenEvents] = useState<SimulationEvent[]>([]);

  const handleTogglePause = () => {
    if (!isPaused) {
      setFrozenEvents([...events]);
    }
    setIsPaused(!isPaused);
  };

  const displayedEvents = isPaused ? frozenEvents : events;

  const filteredEvents = displayedEvents.filter((ev) => {
    if (selectedCategory !== 'ALL' && ev.category !== selectedCategory) return false;
    if (selectedSeverity !== 'ALL' && ev.severity !== selectedSeverity) return false;
    return true;
  });

  const getSeverityIcon = (sev: EventSeverity) => {
    switch (sev) {
      case 'SUCCESS':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'ERROR':
        return <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'FAULT':
        return <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      default:
        return <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    }
  };

  const getCategoryBadge = (cat: EventCategory) => {
    switch (cat) {
      case 'ELECTION':
        return 'bg-amber-950/70 text-amber-300 border-amber-600/40';
      case 'REPLICATION':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-600/40';
      case 'NETWORK':
        return 'bg-blue-950/70 text-blue-300 border-blue-600/40';
      case 'ADAPTIVE':
        return 'bg-purple-950/70 text-purple-300 border-purple-600/40';
      case 'MALICIOUS':
        return 'bg-rose-950/70 text-rose-300 border-rose-600/40';
      default:
        return 'bg-dark-700 text-slate-300 border-dark-600';
    }
  };

  return (
    <div className="bg-dark-800/80 border border-dark-700 rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-4">
      {/* Title & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Consensus State Transition & Event Stream
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-dark-700 text-slate-300">
              {filteredEvents.length} Events
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time audit log of Raft election timeouts, heartbeats, replication ACKs, and network failures.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Pause stream button */}
          <button
            onClick={handleTogglePause}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-semibold transition-all ${
              isPaused
                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                : 'bg-dark-900 border-dark-700 text-slate-300 hover:text-white'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-dark-900 border border-dark-700 rounded px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-brand-blue"
          >
            <option value="ALL">All Categories</option>
            <option value="ELECTION">Election</option>
            <option value="REPLICATION">Replication</option>
            <option value="NETWORK">Network</option>
            <option value="ADAPTIVE">Adaptive</option>
            <option value="MALICIOUS">Malicious</option>
            <option value="SYSTEM">System</option>
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-dark-900 border border-dark-700 rounded px-2.5 py-1 text-slate-300 text-xs focus:outline-none focus:border-brand-blue"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="FAULT">Fault</option>
          </select>
        </div>
      </div>

      {/* Terminal View */}
      <div className="rounded-lg bg-dark-900/90 border border-dark-700 p-3 font-mono text-xs max-h-72 overflow-y-auto space-y-1.5">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-6 text-slate-500 font-sans">
            No events match the selected filters.
          </div>
        ) : (
          filteredEvents.map((ev) => {
            const timeStr = new Date(ev.timestamp * 1000).toLocaleTimeString();
            return (
              <div
                key={ev.event_id}
                className="flex items-start gap-2.5 p-1.5 rounded hover:bg-dark-800/60 transition-colors"
              >
                <div className="mt-0.5">{getSeverityIcon(ev.severity)}</div>
                <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">{timeStr}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getCategoryBadge(
                    ev.category
                  )}`}
                >
                  {ev.category}
                </span>
                <span className="text-slate-200 text-[11px] leading-tight break-all font-sans">
                  {ev.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
