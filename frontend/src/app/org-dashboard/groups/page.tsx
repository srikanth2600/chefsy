'use client';
import { useEffect, useState } from 'react';
import { useChefTheme } from '@/components/chef/ChefThemeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

interface Group {
  id: number;
  name: string;
  description: string | null;
  group_type: string;
  member_count: number;
  created_at: string;
}

export default function GroupsPage() {
  const { t, isDark } = useChefTheme();
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [toast,   setToast]   = useState('');

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState('general');
  const [saving,  setSaving]  = useState(false);

  const inp: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: `1px solid ${t.border}`,
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
    background: t.bgInput, color: t.textPrimary,
  };
  const lbl: React.CSSProperties = {
    fontSize: 11, color: t.textTertiary, display: 'block', marginBottom: 4,
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  const load = () => {
    setLoading(true);
    fetch(`${API}/org/me/groups`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setGroups(Array.isArray(d) ? d : []))
      .catch(() => setError('Failed to load groups.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/org/me/groups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined, group_type: newType }),
      });
      if (r.ok) {
        showToast('Group created!');
        setShowNew(false); setNewName(''); setNewDesc(''); setNewType('general');
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        showToast(d.detail || 'Failed to create group.');
      }
    } catch { showToast('Network error.'); }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete group "${name}"? This cannot be undone.`)) return;
    try {
      const r = await fetch(`${API}/org/me/groups/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` },
      });
      if (r.ok) { showToast('Group deleted.'); load(); }
      else showToast('Failed to delete group.');
    } catch { showToast('Network error.'); }
  };

  return (
    <div style={{ maxWidth: 800, fontFamily: 'inherit', color: t.textPrimary }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: t.textPrimary }}>Groups</h1>
          <p style={{ fontSize: 13, color: t.textSecondary, margin: '4px 0 0' }}>{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          style={{ padding: '9px 20px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
          + New Group
        </button>
      </div>

      {/* New group form */}
      {showNew && (
        <div style={{ background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: t.textPrimary }}>Create Group</p>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Group Name *</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Premium Members" required />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select style={{ ...inp, width: '100%', boxSizing: 'border-box', cursor: 'pointer', colorScheme: isDark ? 'dark' : 'light' }} value={newType} onChange={e => setNewType(e.target.value)}>
                <option value="general" style={{ background: t.bgInput, color: t.textPrimary }}>General</option>
                <option value="premium" style={{ background: t.bgInput, color: t.textPrimary }}>Premium</option>
                <option value="beginner" style={{ background: t.bgInput, color: t.textPrimary }}>Beginner</option>
                <option value="advanced" style={{ background: t.bgInput, color: t.textPrimary }}>Advanced</option>
                <option value="corporate" style={{ background: t.bgInput, color: t.textPrimary }}>Corporate</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Description</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving}
                style={{ padding: '8px 20px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                {saving ? 'Creating…' : 'Create Group'}
              </button>
              <button type="button" onClick={() => setShowNew(false)}
                style={{ ...inp, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}

      {loading ? (
        <div style={{ color: t.textSecondary, fontSize: 14, padding: '20px 0' }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', color: t.textTertiary, fontSize: 14 }}>
          No groups yet. Create your first group to organise members.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {groups.map(g => (
            <div key={g.id} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>👥 {g.name}</span>
                  <span style={{ fontSize: 11, background: t.bgSurface, color: t.textSecondary, border: `1px solid ${t.border}`, borderRadius: 99, padding: '1px 8px', fontWeight: 600, textTransform: 'capitalize' }}>{g.group_type}</span>
                </div>
                {g.description && <p style={{ fontSize: 12, color: t.textSecondary, margin: '4px 0 0' }}>{g.description}</p>}
                <p style={{ fontSize: 12, color: t.textTertiary, margin: '4px 0 0' }}>{g.member_count} member{g.member_count !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => handleDelete(g.id, g.name)}
                style={{ fontSize: 12, color: t.error || '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: t.bgElevated, color: t.textPrimary, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 500, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
