import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import type { PipelineStatus } from '../types';

interface Phase {
  id: string;
  label: string;
}

const PHASE_DESCRIPTIONS: Record<string, string> = {
  scrape: 'LinkedIn, Greenhouse, Lever',
  alerts: 'From saved alert feeds',
  rescore: 'Re-evaluate all jobs',
  'cover-letters': 'For jobs scoring 7+',
  apply: 'LinkedIn Easy Apply',
};

interface CommandPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function CommandPanel({ isOpen, onClose, onComplete }: CommandPanelProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logOffset, setLogOffset] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // fetch phases + status on open
  useEffect(() => {
    if (!isOpen) return;
    axios.get<Phase[]>('/api/pipeline/phases').then(({ data }) => setPhases(data));
    axios.get<PipelineStatus>('/api/pipeline/status').then(({ data }) => {
      setStatus(data);
      setLogs(data.logs);
      setLogOffset(data.logs.length);
    });
  }, [isOpen]);

  // poll for logs + status while running
  useEffect(() => {
    if (!status?.running) return;

    const interval = setInterval(async () => {
      try {
        const [statusRes, logsRes] = await Promise.all([
          axios.get<PipelineStatus>('/api/pipeline/status'),
          axios.get<{ logs: string[]; total: number }>(`/api/pipeline/logs?since=${logOffset}`),
        ]);

        setStatus(statusRes.data);

        if (logsRes.data.logs.length > 0) {
          setLogs((prev) => [...prev, ...logsRes.data.logs]);
          setLogOffset(logsRes.data.total);
        }

        if (!statusRes.data.running) {
          clearInterval(interval);
          setTimeout(() => onComplete(), 1500);
        }
      } catch {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.running, logOffset, onComplete]);

  // auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const togglePhase = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = phases.length > 0 && selected.size === phases.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(phases.map((p) => p.id)));
    }
  };

  const runSelected = async () => {
    try {
      setLogs([]);
      setLogOffset(0);
      const phaseIds = phases.filter((p) => selected.has(p.id)).map((p) => p.id);
      await axios.post('/api/pipeline/run-phases', { phases: phaseIds });
      setStatus({
        running: true,
        phase: 'starting',
        command: phaseIds.length === phases.length ? 'Full Pipeline' : `${phaseIds.length} phases`,
        error: null,
        lastRunAt: null,
        logs: [],
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to start';
      setLogs((prev) => [...prev, `ERROR: ${msg}`]);
    }
  };

  if (!isOpen) return null;

  const running = status?.running ?? false;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="command-panel" onClick={(e) => e.stopPropagation()}>
        <div className="command-panel-header">
          <h2>Pipeline</h2>
          {running && (
            <span className="command-running-badge">
              {status?.command} &mdash; {status?.phase}
            </span>
          )}
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="phase-checklist">
          <label className="phase-item select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={running}
            />
            <span className="phase-label">Select All (Full Pipeline)</span>
          </label>
          {phases.map((phase) => (
            <label key={phase.id} className="phase-item">
              <input
                type="checkbox"
                checked={selected.has(phase.id)}
                onChange={() => togglePhase(phase.id)}
                disabled={running}
              />
              <span className="phase-label">{phase.label}</span>
              {PHASE_DESCRIPTIONS[phase.id] && (
                <span className="phase-desc">{PHASE_DESCRIPTIONS[phase.id]}</span>
              )}
            </label>
          ))}
          <button
            className="run-btn"
            disabled={running || selected.size === 0}
            onClick={runSelected}
          >
            Run {selected.size === phases.length ? 'Full Pipeline' : `${selected.size} Phase${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>

        <div className="log-viewer" ref={logRef}>
          {logs.length === 0 ? (
            <div className="log-empty">Select phases and click Run. Logs will appear here.</div>
          ) : (
            logs.map((line, i) => (
              <div
                key={i}
                className={`log-line ${
                  line.includes('ERROR') || line.includes('[stderr]')
                    ? 'log-error'
                    : line.includes('completed') || line.includes('APPLIED')
                      ? 'log-success'
                      : line.startsWith('[') && line.includes('] ---')
                        ? 'log-header'
                        : ''
                }`}
              >
                {line}
              </div>
            ))
          )}
        </div>

        {status?.error && (
          <div className="command-error">{status.error}</div>
        )}
        {status?.lastRunAt && !running && (
          <div className="command-done">
            Completed at {new Date(status.lastRunAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
