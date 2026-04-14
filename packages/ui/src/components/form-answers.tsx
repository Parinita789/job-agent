import { useState, useEffect } from 'react';
import axios from 'axios';

interface QAEntry {
  question: string;
  type: string;
  options?: string[];
  answer: string;
  source: 'rule' | 'llm';
}

interface JobQALog {
  jobId: string;
  title: string;
  company: string;
  appliedAt: string;
  answers: QAEntry[];
}

interface FormAnswersProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'rules' | 'logs';
}

export function FormAnswers({ isOpen, onClose, defaultTab }: FormAnswersProps) {
  const [tab, setTab] = useState<'rules' | 'logs'>(defaultTab || 'rules');
  const [rules, setRules] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<JobQALog[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    axios.get('/api/form-answers/rules').then(({ data }) => setRules(data));
    axios.get('/api/form-answers/logs').then(({ data }) => setLogs(data));
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await axios.put('/api/form-answers/rules', rules);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (keyword: string, value: string) => {
    setRules((prev) => ({ ...prev, [keyword]: value }));
  };

  const deleteRule = (keyword: string) => {
    setRules((prev) => {
      const next = { ...prev };
      delete next[keyword];
      return next;
    });
  };

  const addRule = () => {
    if (!newKeyword.trim()) return;
    setRules((prev) => ({ ...prev, [newKeyword.trim().toLowerCase()]: newAnswer.trim() }));
    setNewKeyword('');
    setNewAnswer('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addRule();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="form-answers-panel" onClick={(e) => e.stopPropagation()}>
        <div className="form-answers-header">
          <h2>Form Answers</h2>
          <div className="form-answers-tabs">
            <button className={`fa-tab ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>
              Rules
            </button>
            <button className={`fa-tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
              Logs ({logs.length})
            </button>
          </div>
          <div className="form-answers-actions">
            {tab === 'rules' && saved && <span className="profile-saved">Saved</span>}
            {tab === 'rules' && (
              <button className="generate-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="form-answers-body">
          {tab === 'rules' && (
            <>
              <p className="fa-description">
                When a form question contains the keyword, the answer is used automatically (no LLM call).
              </p>
              <div className="fa-add-row">
                <input
                  className="fa-input"
                  placeholder="Keyword (e.g. 'security clearance')"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <input
                  className="fa-input"
                  placeholder="Answer"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="keyword-add-btn" onClick={addRule} disabled={!newKeyword.trim()}>
                  Add
                </button>
              </div>
              <div className="fa-rules-list">
                {Object.entries(rules).map(([keyword, answer]) => (
                  <div key={keyword} className="fa-rule-item">
                    <div className="fa-rule-keyword">{keyword}</div>
                    <input
                      className="fa-rule-answer"
                      value={answer}
                      onChange={(e) => updateRule(keyword, e.target.value)}
                    />
                    <button className="keyword-delete-btn" onClick={() => deleteRule(keyword)}>
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'logs' && (
            <div className="fa-logs-list">
              {logs.length === 0 ? (
                <div className="empty-state"><p>No form answers logged yet. Run Auto Apply to see answers here.</p></div>
              ) : (
                logs.map((job, idx) => (
                  <div key={`${job.jobId}-${idx}`} className="fa-log-job">
                    <div
                      className="fa-log-job-header"
                      onClick={() => setExpandedJob(expandedJob === job.jobId ? null : job.jobId)}
                    >
                      <div>
                        <span className="fa-log-title">{job.title}</span>
                        <span className="fa-log-company"> @ {job.company}</span>
                      </div>
                      <div className="fa-log-meta">
                        <span>{job.answers.length} answers</span>
                        <span className="fa-log-date">{new Date(job.appliedAt).toLocaleDateString()}</span>
                        <span>{expandedJob === job.jobId ? '▼' : '▶'}</span>
                      </div>
                    </div>
                    {expandedJob === job.jobId && (
                      <div className="fa-log-answers">
                        {job.answers.map((qa, i) => (
                          <div key={i} className="fa-log-qa">
                            <div className="fa-log-question">
                              <span className={`fa-source ${qa.source}`}>{qa.source}</span>
                              {qa.question}
                            </div>
                            <div className="fa-log-answer">{qa.answer}</div>
                            {qa.options && (
                              <div className="fa-log-options">Options: {qa.options.join(', ')}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
