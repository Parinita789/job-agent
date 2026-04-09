import { useState, useEffect } from 'react';
import axios from 'axios';

export interface CoverLetterJob {
  id: string;
  title: string;
  company: string;
  matched_skills: string[];
  fit_score: number;
  source: string;
  cover_letter: string;
  generated_at: string;
}

interface CoverLettersPageProps {
  jobs: CoverLetterJob[];
}

export function CoverLettersPage({ jobs }: CoverLettersPageProps) {
  const [selected, setSelected] = useState<CoverLetterJob | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = search
    ? jobs.filter((j) =>
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.company.toLowerCase().includes(search.toLowerCase()) ||
        j.matched_skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
      )
    : jobs;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-select first job
  useEffect(() => {
    if (!selected && filtered.length > 0) setSelected(filtered[0]);
  }, [filtered, selected]);

  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <p>No cover letters generated yet. Open a job and click "Generate Cover Letter".</p>
      </div>
    );
  }

  return (
    <div className="cl-page">
      <div className="cl-sidebar">
        <div className="cl-search">
          <input
            className="cl-search-input"
            placeholder="Search by title, company, or skill..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="cl-list">
          {filtered.map((job) => (
            <div
              key={job.id}
              className={`cl-item ${selected?.id === job.id ? 'active' : ''}`}
              onClick={() => { setSelected(job); setCopied(false); }}
            >
              <div className="cl-item-header">
                <span className="cl-item-title">{job.title}</span>
                <span className={`score ${job.fit_score >= 7 ? 'high' : job.fit_score >= 5 ? 'mid' : 'low'}`}>
                  {job.fit_score}
                </span>
              </div>
              <div className="cl-item-company">{job.company}</div>
              <div className="cl-item-skills">
                {job.matched_skills.slice(0, 4).map((s) => (
                  <span key={s} className="skill-tag">{s}</span>
                ))}
                {job.matched_skills.length > 4 && (
                  <span className="skill-tag">+{job.matched_skills.length - 4}</span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="cl-no-results">No matches for "{search}"</div>
          )}
        </div>
      </div>

      <div className="cl-main">
        {selected ? (
          <>
            <div className="cl-preview-header">
              <div>
                <div className="cl-preview-title">{selected.title}</div>
                <div className="cl-preview-company">
                  {selected.company}
                  <span className={`platform ${selected.source}`} style={{ marginLeft: '10px' }}>{selected.source}</span>
                </div>
                <div className="cl-preview-skills">
                  {selected.matched_skills.map((s) => (
                    <span key={s} className="skill-tag">{s}</span>
                  ))}
                </div>
              </div>
              <button
                className="cl-copy-btn"
                onClick={() => copyToClipboard(selected.cover_letter)}
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
            <pre className="cl-content">{selected.cover_letter}</pre>
          </>
        ) : (
          <div className="empty-state"><p>Select a job to view its cover letter</p></div>
        )}
      </div>
    </div>
  );
}
