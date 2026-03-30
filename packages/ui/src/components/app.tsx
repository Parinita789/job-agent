import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { ScoredJob } from '../types';
import { TabBar } from './tab-bar';
import { JobTable } from './job-table';
import { JobDetail } from './job-detail';
import { CommandPanel } from './command-panel';
import { KeywordManager } from './keyword-manager';

type Tab = 'queue' | 'applied' | 'rejected';
type PlatformFilter = 'all' | 'linkedin' | 'greenhouse' | 'lever';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ScoredJob | null>(null);
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);
  const [keywordManagerOpen, setKeywordManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await axios.get<ScoredJob[]>('/api/jobs');
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // refresh jobs when command panel closes
  const handleClosePanel = useCallback(() => {
    setCommandPanelOpen(false);
    fetchJobs();
  }, [fetchJobs]);

  const handleCommandComplete = useCallback(async () => {
    await fetchJobs();
    setCommandPanelOpen(false);
    setActiveTab('queue');
  }, [fetchJobs]);

  // also poll for fresh data every 30s in case commands were run from CLI
  useEffect(() => {
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const filtered = platformFilter === 'all' ? jobs : jobs.filter((j) => j.source === platformFilter);
  const queue = filtered.filter((j) => j.status === 'to_apply');
  const applied = filtered.filter((j) => j.status === 'applied');
  const rejected = filtered.filter((j) => j.status === 'rejected');

  const tabJobs = activeTab === 'queue' ? queue : activeTab === 'applied' ? applied : rejected;

  if (loading) {
    return (
      <div className="container">
        <h1>Job Tracker</h1>
        <div className="empty-state"><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Job Tracker</h1>
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{ queue: queue.length, applied: applied.length, rejected: rejected.length }}
        onOpenCommands={() => setCommandPanelOpen(true)}
        onOpenKeywords={() => setKeywordManagerOpen(true)}
      />
      <div className="platform-filter">
        {(['all', 'linkedin', 'greenhouse', 'lever'] as PlatformFilter[]).map((p) => (
          <button
            key={p}
            className={`filter-btn ${platformFilter === p ? 'active' : ''}`}
            onClick={() => setPlatformFilter(p)}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <JobTable jobs={tabJobs} activeTab={activeTab} onSelectJob={setSelectedJob} />
      {selectedJob && (
        <JobDetail job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
      <CommandPanel
        isOpen={commandPanelOpen}
        onClose={handleClosePanel}
        onComplete={handleCommandComplete}
      />
      <KeywordManager
        isOpen={keywordManagerOpen}
        onClose={() => setKeywordManagerOpen(false)}
      />
    </div>
  );
}
