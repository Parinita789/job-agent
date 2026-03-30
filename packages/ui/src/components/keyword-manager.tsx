import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { AlertKeyword } from '../types';

interface KeywordManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeywordManager({ isOpen, onClose }: KeywordManagerProps) {
  const [alerts, setAlerts] = useState<AlertKeyword[]>([]);
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('United States');
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await axios.get<AlertKeyword[]>('/api/alerts');
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchAlerts();
  }, [isOpen, fetchAlerts]);

  const handleAdd = async () => {
    const trimmed = keywords.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await axios.post('/api/alerts', { keywords: trimmed, location });
      setKeywords('');
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to add alert:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/alerts/${id}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleAdd();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="keyword-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keyword-panel-header">
          <h2>Search Keywords</h2>
          <span className="keyword-count">{alerts.length} keyword(s)</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="keyword-add-row">
          <input
            type="text"
            className="keyword-input"
            placeholder="e.g. senior backend engineer node"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <select
            className="keyword-select"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="United States">United States</option>
            <option value="Remote">Remote</option>
            <option value="San Francisco Bay Area">SF Bay Area</option>
            <option value="New York City Metropolitan Area">NYC Metro</option>
            <option value="Seattle, Washington">Seattle</option>
            <option value="Austin, Texas">Austin</option>
            <option value="Los Angeles Metropolitan Area">Los Angeles</option>
          </select>
          <button
            className="keyword-add-btn"
            onClick={handleAdd}
            disabled={loading || !keywords.trim()}
          >
            Add
          </button>
        </div>

        <div className="keyword-list">
          {alerts.length === 0 && (
            <div className="keyword-empty">No keywords configured. Add one above to start scraping LinkedIn alerts.</div>
          )}
          {alerts.map((alert) => (
            <div key={alert.id} className="keyword-item">
              <div className="keyword-item-info">
                <span className="keyword-item-keywords">{alert.keywords}</span>
                <span className="keyword-item-location">{alert.location}</span>
              </div>
              <button
                className="keyword-delete-btn"
                onClick={() => handleDelete(alert.id)}
                title="Delete keyword"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
