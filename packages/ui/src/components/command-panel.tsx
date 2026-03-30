import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import type { PipelineStatus, PipelineCommand } from '../types';

interface CommandPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function CommandPanel({ isOpen, onClose, onComplete }: CommandPanelProps) {
  const [commands, setCommands] = useState<PipelineCommand[]>([]);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logOffset, setLogOffset] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  // fetch available commands
  useEffect(() => {
    if (!isOpen) return;
    axios.get<PipelineCommand[]>('/api/pipeline/commands').then(({ data }) => setCommands(data));
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
          // brief delay so user sees "completed", then close and refresh
          setTimeout(() => {
            onComplete();
          }, 1500);
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

  const runCommand = async (commandId: string) => {
    try {
      setLogs([]);
      setLogOffset(0);
      await axios.post(`/api/pipeline/run/${commandId}`);
      setStatus({
        running: true,
        phase: 'starting',
        command: commands.find((c) => c.id === commandId)?.label ?? commandId,
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
          <h2>Commands</h2>
          {running && (
            <span className="command-running-badge">
              {status?.command} &mdash; {status?.phase}
            </span>
          )}
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="command-grid">
          {commands.map((cmd) => (
            <button
              key={cmd.id}
              className="command-btn"
              disabled={running}
              onClick={() => runCommand(cmd.id)}
            >
              <span className="command-btn-label">{cmd.label}</span>
              <span className="command-btn-id">{cmd.id}</span>
            </button>
          ))}
        </div>

        <div className="log-viewer" ref={logRef}>
          {logs.length === 0 ? (
            <div className="log-empty">Select a command to run. Logs will appear here.</div>
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
