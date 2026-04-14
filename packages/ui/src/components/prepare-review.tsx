import { useState, useCallback, Fragment } from 'react';
import axios from 'axios';

interface ApplicationField {
  label: string;
  type: string;
  value: string;
  source: 'profile' | 'rule' | 'llm' | 'unknown';
  options: string[];
  fieldId: string;
  required?: boolean;
}

interface ApplicationFieldsJob {
  externalJobId: string;
  title: string;
  company: string;
  source: string;
  url: string;
  status: 'ready' | 'needs_review' | 'pending' | 'applied';
  fields: ApplicationField[];
  unknownCount: number;
  coverLetter: string;
  scrapedAt: string;
}

interface PrepareReviewProps {
  jobs: ApplicationFieldsJob[];
  onRefresh: () => void;
  onAutoApply: (jobIds: string[]) => void;
  onDismissJob?: (jobId: string) => void;
}

function sourceTag(source: string) {
  const colors: Record<string, string> = {
    profile: 'var(--blue)',
    rule: 'var(--green)',
    llm: 'var(--orange)',
    unknown: 'var(--red)',
  };
  return (
    <span className="prepare-source-tag" style={{ color: colors[source] || 'var(--text-muted)' }}>
      {source}
    </span>
  );
}

function statusIcon(status: string) {
  if (status === 'ready') return <span className="prepare-status ready">Ready</span>;
  if (status === 'needs_review') return <span className="prepare-status review">Review</span>;
  if (status === 'applied') return <span className="prepare-status applied">Applied</span>;
  return <span className="prepare-status pending">Pending</span>;
}

export function PrepareReview({ jobs, onRefresh, onAutoApply, onDismissJob }: PrepareReviewProps) {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ jobId: string; index: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const activeJobs = jobs.filter((j) => j.status !== 'applied');

  const toggleExpand = useCallback((jobId: string) => {
    setExpandedJob((prev) => (prev === jobId ? null : jobId));
    setEditingField(null);
  }, []);

  const startEdit = useCallback((jobId: string, index: number, currentValue: string) => {
    setEditingField({ jobId, index });
    setEditValue(currentValue);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingField) return;
    setSaving(true);
    try {
      await axios.put(
        `/api/application-fields/${editingField.jobId}/fields/${editingField.index}`,
        { value: editValue, saveAsRule: true },
      );
      onRefresh();
      setEditingField(null);
    } catch (err) {
      console.error('Failed to save field:', err);
    } finally {
      setSaving(false);
    }
  }, [editingField, editValue, onRefresh]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allIds = activeJobs.map((j) => j.externalJobId);
    if (allIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleApplySelected = () => {
    if (selectedIds.size > 0) {
      onAutoApply(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleDismiss = useCallback(async (jobId: string) => {
    try {
      await axios.delete(`/api/application-fields/${jobId}`);
      onDismissJob?.(jobId);
      onRefresh();
    } catch (err) {
      console.error('Failed to dismiss job:', err);
    }
  }, [onDismissJob, onRefresh]);

  if (activeJobs.length === 0) {
    return (
      <div className="empty-state">
        <p>No pre-scraped applications yet</p>
        <p className="prepare-hint">Jobs scoring 7+ will have their forms pre-scraped automatically during scraping.</p>
      </div>
    );
  }

  const readyCount = activeJobs.filter((j) => j.status === 'ready').length;
  const reviewCount = activeJobs.filter((j) => j.status === 'needs_review').length;

  return (
    <div className="prepare-container">
      <div className="prepare-summary">
        {readyCount > 0 ? (
          <button
            className="prepare-stat ready prepare-stat-btn"
            onClick={() => {
              const readyIds = activeJobs.filter((j) => j.status === 'ready').map((j) => j.externalJobId);
              onAutoApply(readyIds);
            }}
            title="Auto apply to all ready jobs"
          >
            {readyCount} Ready — Click to Apply
          </button>
        ) : (
          <span className="prepare-stat ready">{readyCount} Ready</span>
        )}
        <span className="prepare-stat review">{reviewCount} Need Review</span>
        <span className="prepare-stat total">{activeJobs.length} Total</span>
        <div className="prepare-actions">
          {selectMode ? (
            <>
              <button className="prepare-select-all-btn" onClick={toggleAll}>
                {activeJobs.every((j) => selectedIds.has(j.externalJobId))
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
              <button
                className="auto-apply-btn"
                disabled={selectedIds.size === 0}
                onClick={() => { handleApplySelected(); setSelectMode(false); }}
              >
                Auto Apply ({selectedIds.size})
              </button>
              <button className="prepare-cancel-btn" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
                Cancel
              </button>
            </>
          ) : (
            <button className="select-to-apply-btn" onClick={() => setSelectMode(true)}>
              Select to Apply
            </button>
          )}
        </div>
      </div>

      <table className="job-table prepare-table">
        <thead>
          <tr>
            {selectMode && <th style={{ width: 40 }}></th>}
            <th>Score</th>
            <th>Company</th>
            <th>Position</th>
            <th>Fields</th>
            <th>Unknown</th>
            <th>Status</th>
            <th>Platform</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {activeJobs.map((job) => {
            const isExpanded = expandedJob === job.externalJobId;
            return (
              <Fragment key={job.externalJobId}>
                <tr
                  className={isExpanded ? 'prepare-row expanded' : 'prepare-row'}
                  onClick={() => toggleExpand(job.externalJobId)}
                >
                  {selectMode && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(job.externalJobId)}
                        onChange={() => toggleSelect(job.externalJobId)}
                      />
                    </td>
                  )}
                  <td>
                    <span className="score high">7+</span>
                  </td>
                  <td>{job.company}</td>
                  <td>{job.title}</td>
                  <td>{job.fields.length}</td>
                  <td>
                    {job.unknownCount > 0 ? (
                      <span className="prepare-unknown-count">{job.unknownCount}</span>
                    ) : (
                      <span className="prepare-all-good">0</span>
                    )}
                  </td>
                  <td>{statusIcon(job.status)}</td>
                  <td>
                    <span className={`platform ${job.source}`}>{job.source}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="prepare-apply-btn"
                      title="Auto apply to this job"
                      onClick={() => onAutoApply([job.externalJobId])}
                    >
                      Auto Apply
                    </button>
                  </td>
                  <td>
                    <button
                      className="dismiss-btn"
                      title="Remove from prepare list"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(job.externalJobId);
                      }}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="prepare-detail-row">
                    <td colSpan={selectMode ? 10 : 9}>
                      <div className="prepare-fields">
                        <div className="prepare-fields-header">
                          <h4>Application Fields</h4>
                          <a href={job.url} target="_blank" rel="noopener noreferrer" className="prepare-job-link">
                            View Job Posting
                          </a>
                        </div>
                        <table className="prepare-fields-table">
                          <thead>
                            <tr>
                              <th>Field</th>
                              <th>Type</th>
                              <th>Answer</th>
                              <th>Source</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {job.fields
                              .filter((f) => !(f.type === 'file' && f.label.toLowerCase().includes('cover letter')))
                              .map((field, idx) => {
                              const realIdx = job.fields.indexOf(field);
                              const isEditing =
                                editingField?.jobId === job.externalJobId && editingField?.index === realIdx;
                              return (
                                <tr
                                  key={realIdx}
                                  className={field.source === 'unknown' && field.type !== 'file' && field.required ? 'prepare-field-unknown' : ''}
                                >
                                  <td className="prepare-field-label">
                                    {field.label}
                                    {field.required && <span className="prepare-required">*</span>}
                                  </td>
                                  <td className="prepare-field-type">{field.type}</td>
                                  <td className="prepare-field-value">
                                    {isEditing ? (
                                      <div className="prepare-edit-inline">
                                        {field.options.length > 0 && field.options.length <= 50 && field.label.toLowerCase().match(/select all|mark all|check all|all that apply/) ? (
                                          <div className="prepare-checkbox-list">
                                            {field.options.map((opt) => {
                                              const selected = editValue.split(',').map(v => v.trim()).includes(opt);
                                              return (
                                                <label key={opt} className="prepare-checkbox-item">
                                                  <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => {
                                                      const vals = editValue ? editValue.split(',').map(v => v.trim()).filter(Boolean) : [];
                                                      if (selected) {
                                                        setEditValue(vals.filter(v => v !== opt).join(', '));
                                                      } else {
                                                        setEditValue([...vals, opt].join(', '));
                                                      }
                                                    }}
                                                  />
                                                  {opt}
                                                </label>
                                              );
                                            })}
                                          </div>
                                        ) : field.options.length > 0 && field.options.length <= 50 ? (
                                          <select
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            autoFocus
                                          >
                                            <option value="">-- Select --</option>
                                            {field.options.map((opt) => (
                                              <option key={opt} value={opt}>
                                                {opt}
                                              </option>
                                            ))}
                                          </select>
                                        ) : field.type === 'textarea' ? (
                                          <textarea
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            rows={3}
                                            autoFocus
                                          />
                                        ) : (
                                          <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') saveEdit();
                                              if (e.key === 'Escape') cancelEdit();
                                            }}
                                          />
                                        )}
                                        <div className="prepare-edit-actions">
                                          <button className="prepare-save-btn" onClick={saveEdit} disabled={saving}>
                                            {saving ? '...' : 'Save'}
                                          </button>
                                          <button className="prepare-cancel-btn" onClick={cancelEdit}>
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <span className={field.value ? '' : 'prepare-empty-value'}>
                                          {field.value || '(empty)'}
                                        </span>
                                        {field.options.length > 0 && field.options.length <= 50 && (
                                          <div className="prepare-options-list">
                                            {field.options.map((opt) => {
                                              const selected = field.value.split(',').map(v => v.trim().toLowerCase()).includes(opt.toLowerCase())
                                                || field.value.toLowerCase() === opt.toLowerCase();
                                              return (
                                                <span key={opt} className={`prepare-option-chip ${selected ? 'selected' : ''}`}>
                                                  {selected && <span className="prepare-option-check">&#10003;</span>}
                                                  {opt}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                        {field.options.length > 50 && (
                                          <span className="prepare-options-hint"> ({field.options.length} options)</span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td>{sourceTag(field.source)}</td>
                                  <td>
                                    {field.type !== 'file' && !isEditing && (
                                      <button
                                        className="prepare-edit-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEdit(job.externalJobId, realIdx, field.value);
                                        }}
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {job.coverLetter && (
                          <div className="prepare-cover-letter">
                            <h4>Cover Letter</h4>
                            <pre>{job.coverLetter}</pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
