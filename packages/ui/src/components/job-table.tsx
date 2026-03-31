import type { ScoredJob } from '../types';

type Tab = 'queue' | 'applied' | 'rejected';

interface JobTableProps {
  jobs: ScoredJob[];
  activeTab: Tab;
  onSelectJob: (job: ScoredJob) => void;
  onDismissJob?: (job: ScoredJob) => void;
  onMarkApplied?: (job: ScoredJob) => void;
}

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return '--';
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  return min ? fmt(min) : fmt(max!);
}

function scoreClass(score: number): string {
  if (score >= 7) return 'high';
  if (score >= 5) return 'mid';
  return 'low';
}

export function JobTable({ jobs, activeTab, onSelectJob, onDismissJob, onMarkApplied }: JobTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="empty-state">
        <p>No jobs in this category</p>
      </div>
    );
  }

  const sorted = [...jobs].sort((a, b) => {
    // New jobs first (scraped within last 24h), then by score
    const now = Date.now();
    const aNew = now - new Date(a.scraped_at).getTime() < 86400000 ? 1 : 0;
    const bNew = now - new Date(b.scraped_at).getTime() < 86400000 ? 1 : 0;
    if (bNew !== aNew) return bNew - aNew;
    return b.fit_score - a.fit_score;
  });

  const isNew = (scraped_at: string) => Date.now() - new Date(scraped_at).getTime() < 86400000;

  return (
    <table className="job-table">
      <thead>
        <tr>
          <th>Score</th>
          <th>Company</th>
          <th>Position</th>
          <th>Salary</th>
          {activeTab !== 'rejected' && <th>Tech Stack</th>}
          <th>Platform</th>
          {activeTab === 'applied' && <th>Applied</th>}
          {activeTab === 'rejected' && <th>Reason</th>}
          {activeTab === 'queue' && <th>Apply</th>}
          {activeTab === 'queue' && <th></th>}
        </tr>
      </thead>
      <tbody>
        {sorted.map((job) => (
          <tr key={job.id} onClick={() => onSelectJob(job)}>
            <td>
              <span className={`score ${scoreClass(job.fit_score)}`}>
                {job.fit_score}
              </span>
            </td>
            <td>
              {job.company}
              {isNew(job.scraped_at) && <span className="new-badge">New</span>}
            </td>
            <td>{job.title}</td>
            <td>
              <span className="salary">
                {formatSalary(job.salary_min, job.salary_max)}
              </span>
            </td>
            {activeTab !== 'rejected' && (
              <td>
                <div className="skills">
                  {job.matched_skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="skill-tag">{skill}</span>
                  ))}
                  {job.matched_skills.length > 4 && (
                    <span className="skill-tag">+{job.matched_skills.length - 4}</span>
                  )}
                </div>
              </td>
            )}
            <td>
              <span className={`platform ${job.source}`}>{job.source}</span>
            </td>
            {activeTab === 'applied' && (
              <td>
                <div className="applied-info">
                  <span className={`applied-via ${job.applied_via || 'manual'}`}>
                    {job.applied_via === 'auto' ? 'Auto' : 'Manual'}
                  </span>
                  <span className="applied-date">
                    {job.applied_at ? new Date(job.applied_at).toLocaleDateString() : '--'}
                  </span>
                </div>
              </td>
            )}
            {activeTab === 'rejected' && (
              <td>
                <span className="reason-text" title={job.reason}>
                  {job.reason}
                </span>
              </td>
            )}
            {activeTab === 'queue' && (
              <td>
                <div className="apply-actions">
                  <a
                    className="apply-link"
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Apply
                  </a>
                  <button
                    className="applied-btn"
                    title="Mark as applied"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkApplied?.(job);
                    }}
                  >
                    Applied
                  </button>
                </div>
              </td>
            )}
            {activeTab === 'queue' && (
              <td>
                <button
                  className="dismiss-btn"
                  title="Mark as expired / not available"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismissJob?.(job);
                  }}
                >
                  &times;
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
