import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { ScoredJob } from '../types';
import { TabBar } from './tab-bar';
import { JobTable } from './job-table';
import { JobDetail } from './job-detail';
import { CommandPanel } from './command-panel';
import { KeywordManager } from './keyword-manager';
import { ProfileEditor } from './profile-editor';

type Tab = 'queue' | 'applied' | 'rejected';
type PlatformFilter = 'all' | 'linkedin' | 'greenhouse' | 'lever' | 'indeed';

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ScoredJob | null>(null);
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);
  const [keywordManagerOpen, setKeywordManagerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleClosePanel = useCallback(() => {
    setCommandPanelOpen(false);
    fetchJobs();
  }, [fetchJobs]);

  const handleCommandComplete = useCallback(async () => {
    await fetchJobs();
    setCommandPanelOpen(false);
    setActiveTab('queue');
  }, [fetchJobs]);

  useEffect(() => {
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleDismissJob = useCallback(async (job: ScoredJob) => {
    try {
      await axios.patch(`/api/jobs/${job.id}/status`, {
        status: 'rejected',
        reason: 'Posting no longer available',
      });
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: 'rejected' as const, reason: 'Posting no longer available' } : j));
    } catch (err) {
      console.error('Failed to dismiss job:', err);
    }
  }, []);

  const handleMarkApplied = useCallback(async (job: ScoredJob) => {
    try {
      await axios.patch(`/api/jobs/${job.id}/status`, { status: 'applied' });
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: 'applied' as const, applied_at: new Date().toISOString() } : j));
    } catch (err) {
      console.error('Failed to mark applied:', err);
    }
  }, []);

  const filtered = platformFilter === 'all' ? jobs : jobs.filter((j) => j.source === platformFilter);
  const queue = filtered.filter((j) => j.status === 'to_apply');
  const applied = filtered.filter((j) => j.status === 'applied');
  const rejected = filtered.filter((j) => j.status === 'rejected');
  const tabJobs = activeTab === 'queue' ? queue : activeTab === 'applied' ? applied : rejected;

  if (loading) {
    return (
      <div className="container">
        <div className="app-header"><h1>Job Tracker</h1></div>
        <div className="empty-state"><p>Loading...</p></div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="app-header">
        <h1>Job Tracker</h1>
        <div className="hamburger-wrapper">
          <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span /><span />
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="hamburger-menu">
                <button onClick={() => { setProfileOpen(true); setMenuOpen(false); }}>
                  Candidate Profile
                </button>
                <button onClick={() => { setKeywordManagerOpen(true); setMenuOpen(false); }}>
                  Keywords
                </button>
                <button onClick={() => { setCommandPanelOpen(true); setMenuOpen(false); }}>
                  Pipeline
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{ queue: queue.length, applied: applied.length, rejected: rejected.length }}
        onOpenCommands={() => setCommandPanelOpen(true)}
        onOpenKeywords={() => setKeywordManagerOpen(true)}
      />
      <div className="platform-filter">
        {(['all', 'linkedin', 'greenhouse', 'lever', 'indeed'] as PlatformFilter[]).map((p) => (
          <button
            key={p}
            className={`filter-btn ${platformFilter === p ? 'active' : ''}`}
            onClick={() => setPlatformFilter(p)}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <JobTable jobs={tabJobs} activeTab={activeTab} onSelectJob={setSelectedJob} onDismissJob={handleDismissJob} onMarkApplied={handleMarkApplied} />
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onJobUpdate={(updated) => {
            setSelectedJob(updated);
            setJobs((prev) => prev.map((j) => j.id === updated.id ? updated : j));
          }}
        />
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
      <ProfileEditor
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  );
}
