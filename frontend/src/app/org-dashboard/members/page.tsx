'use client';
import { useEffect, useState } from 'react';
import { useChefTheme } from '@/components/chef/ChefThemeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

interface Member {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  joined_at: string | null;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  active:             { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
  invited:            { bg: 'rgba(234,179,8,0.15)',   color: '#eab308' },
  profile_incomplete: { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
  inactive:           { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
  suspended:          { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
};

export default function MembersPage() {
  const { t } = useChefTheme();
  const [members,  setMembers]  = useState<Member[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [toast,    setToast]    = useState('');

  const [showInvite, setShowInvite] = useState(false);
  const [invEmail,   setInvEmail]   = useState('');
  const [invName,    setInvName]    = useState('');
  const [invPhone,   setInvPhone]   = useState('');
  const [inviting,   setInviting]   = useState(false);

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
    fetch(`${API}/org/me/members`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setMembers(Array.isArray(d) ? d : []))
      .catch(() => setError('Failed to load members.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invEmail.trim()) return;
    setInviting(true);
    try {
      const r = await fetch(`${API}/org/me/members/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invEmail.trim(), full_name: invName.trim() || undefined, phone: invPhone.trim() || undefined }),
      });
      if (r.ok) {
        showToast('Invite sent!');
        setShowInvite(false); setInvEmail(''); setInvName(''); setInvPhone('');
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        showToast(d.detail || 'Failed to send invite.');
      }
    } catch { showToast('Network error.'); }
    setInviting(false);
  };

  const filtered = members.filter(m =>
    !search || m.email.includes(search) || (m.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 900, fontFamily: 'inherit', color: t.textPrimary }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: t.textPrimary }}>Members</h1>
          <p style={{ fontSize: 13, color: t.textSecondary, margin: '4px 0 0' }}>{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          style={{ padding: '9px 20px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
          + Invite Member
        </button>
      </div>

      {/* Search */}
      <input style={{ ...inp, width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
        placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />

      {/* Invite form */}
      {showInvite && (
        <div style={{ background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: t.textPrimary }}>Invite a Member</p>
          <form onSubmit={handleInvite} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Email *</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="member@example.com" required />
            </div>
            <div>
              <label style={lbl}>Full Name</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={invName} onChange={e => setInvName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={invPhone} onChange={e => setInvPhone(e.target.value)} placeholder="+44 7000 000000" />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <button type="submit" disabled={inviting}
                style={{ padding: '8px 20px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
              <button type="button" onClick={() => setShowInvite(false)}
                style={{ ...inp, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>{error}</div>}

      {loading ? (
        <div style={{ color: t.textSecondary, fontSize: 14, padding: '20px 0' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', color: t.textTertiary, fontSize: 14 }}>
          {search ? 'No members match your search.' : 'No members yet. Invite your first member above.'}
        </div>
      ) : (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: t.bgSurface, borderBottom: `1px solid ${t.border}` }}>
                {['Name / Email', 'Phone', 'Status', 'Joined'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: t.textTertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const st = STATUS_COLOR[m.status] || STATUS_COLOR.inactive;
                return (
                  <tr key={m.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : 'none' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: t.textPrimary }}>{m.full_name || '—'}</div>
                      <div style={{ color: t.textSecondary, fontSize: 12 }}>{m.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: t.textSecondary }}>{m.phone || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: t.textSecondary }}>
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
