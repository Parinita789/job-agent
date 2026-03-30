import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function SkillGroup({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addItem((e.target as HTMLInputElement).value);
    } else if (e.key === 'Escape') {
      setAdding(false);
    }
  };

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  return (
    <div className="skill-group">
      {label && <div className="skill-group-label">{label}</div>}
      <div className="skill-group-items">
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="skill-chip">
            {item}
            <button className="skill-chip-remove" onClick={() => removeItem(i)}>&times;</button>
          </span>
        ))}
        {adding ? (
          <input
            ref={inputRef}
            className="skill-chip-input"
            placeholder="Type and press Enter"
            onKeyDown={handleKeyDown}
            onBlur={(e) => addItem(e.target.value)}
          />
        ) : (
          <button className="skill-chip-add" onClick={() => setAdding(true)}>+</button>
        )}
      </div>
    </div>
  );
}

interface ProfileEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileEditor({ isOpen, onClose }: ProfileEditorProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSaved(false);
    setError(null);
    axios.get('/api/profile')
      .then(({ data }) => setProfile(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const { data } = await axios.put('/api/profile', profile);
      setProfile(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (path: string[], value: any) => {
    setProfile((prev: any) => {
      const updated = JSON.parse(JSON.stringify(prev));
      let obj = updated;
      for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
      return updated;
    });
  };

  const updateArrayField = (path: string[], value: string) => {
    const arr = value.split(',').map((s) => s.trim()).filter(Boolean);
    updateField(path, arr);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-panel-header">
          <h2>Candidate Profile</h2>
          <div className="profile-header-actions">
            {saved && <span className="profile-saved">Saved</span>}
            {error && <span className="profile-error-badge">{error}</span>}
            <button className="generate-btn" onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        {loading ? (
          <div className="profile-body"><div className="empty-state"><p>Loading...</p></div></div>
        ) : !profile ? (
          <div className="profile-body"><div className="empty-state"><p>{error || 'No profile found'}</p></div></div>
        ) : (
          <div className="profile-body">
            {/* Personal */}
            <section className="profile-section">
              <h3>Personal</h3>
              <div className="profile-grid">
                <label>Name<input value={profile.personal?.name || ''} onChange={(e) => updateField(['personal', 'name'], e.target.value)} /></label>
                <label>Email<input value={profile.personal?.email || ''} onChange={(e) => updateField(['personal', 'email'], e.target.value)} /></label>
                <label>Phone<input value={profile.personal?.phone || ''} onChange={(e) => updateField(['personal', 'phone'], e.target.value)} /></label>
                <label>Location<input value={profile.personal?.location || ''} onChange={(e) => updateField(['personal', 'location'], e.target.value)} /></label>
                <label>LinkedIn<input value={profile.personal?.linkedin || ''} onChange={(e) => updateField(['personal', 'linkedin'], e.target.value)} /></label>
                <label>GitHub<input value={profile.personal?.github || ''} onChange={(e) => updateField(['personal', 'github'], e.target.value)} /></label>
              </div>
            </section>

            {/* Experience */}
            <section className="profile-section">
              <h3>Experience</h3>
              <div className="profile-grid">
                <label>Current Level<input value={profile.experience?.current_level || ''} onChange={(e) => updateField(['experience', 'current_level'], e.target.value)} /></label>
                <label>Total Years<input type="number" value={profile.experience?.total_years || 0} onChange={(e) => updateField(['experience', 'total_years'], Number(e.target.value))} /></label>
              </div>
              <label className="profile-full-width">Summary<textarea rows={3} value={profile.experience?.summary || ''} onChange={(e) => updateField(['experience', 'summary'], e.target.value)} /></label>
            </section>

            {/* Skills */}
            <section className="profile-section">
              <h3>Skills</h3>
              {Object.entries(profile.skills || {}).map(([key, val]) => (
                <SkillGroup
                  key={key}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  items={val as string[]}
                  onChange={(items: string[]) => updateField(['skills', key], items)}
                />
              ))}
            </section>

            {/* Preferences */}
            <section className="profile-section">
              <h3>Preferences</h3>
              <SkillGroup
                label="Target Roles"
                items={profile.preferences?.target_roles || []}
                onChange={(items: string[]) => updateField(['preferences', 'target_roles'], items)}
              />
              <SkillGroup
                label="Preferred Domains"
                items={profile.preferences?.preferred_domains || []}
                onChange={(items: string[]) => updateField(['preferences', 'preferred_domains'], items)}
              />
              <SkillGroup
                label="Employment Type"
                items={profile.preferences?.employment_type || []}
                onChange={(items: string[]) => updateField(['preferences', 'employment_type'], items)}
              />
              <div className="profile-grid" style={{ marginTop: '8px' }}>
                <label>Current City
                  <input value={profile.preferences?.location?.current_city || ''} onChange={(e) => updateField(['preferences', 'location', 'current_city'], e.target.value)} />
                </label>
              </div>
              <div className="profile-checkboxes">
                {['remote', 'hybrid_us', 'onsite', 'international_remote'].map((key) => (
                  <label key={key} className="profile-checkbox">
                    <input type="checkbox" checked={profile.preferences?.location?.[key] || false} onChange={(e) => updateField(['preferences', 'location', key], e.target.checked)} />
                    {key.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </section>

            {/* Compensation */}
            <section className="profile-section">
              <h3>Compensation</h3>
              <div className="profile-grid">
                <label>Base Salary Min ($)
                  <input type="number" value={profile.compensation?.base_salary_min || 0} onChange={(e) => updateField(['compensation', 'base_salary_min'], Number(e.target.value))} />
                </label>
                <label>Base Salary Preferred ($)
                  <input type="number" value={profile.compensation?.base_salary_preferred || 0} onChange={(e) => updateField(['compensation', 'base_salary_preferred'], Number(e.target.value))} />
                </label>
              </div>
            </section>

            {/* Deal Breakers */}
            <section className="profile-section">
              <h3>Deal Breakers</h3>
              <SkillGroup
                label=""
                items={profile.deal_breakers || []}
                onChange={(items: string[]) => updateField(['deal_breakers'], items)}
              />
            </section>

            {/* Cover Letter Strengths */}
            <section className="profile-section">
              <h3>Cover Letter Strengths</h3>
              <SkillGroup
                label=""
                items={profile.strengths_for_agent?.use_for_cover_letter || []}
                onChange={(items: string[]) => updateField(['strengths_for_agent', 'use_for_cover_letter'], items)}
              />
            </section>

            {/* ATS Keywords */}
            <section className="profile-section">
              <h3>ATS Keywords</h3>
              <SkillGroup
                label=""
                items={profile.strengths_for_agent?.ats_keywords || []}
                onChange={(items: string[]) => updateField(['strengths_for_agent', 'ats_keywords'], items)}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
