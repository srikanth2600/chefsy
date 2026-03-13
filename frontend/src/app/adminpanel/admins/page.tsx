'use client';
/**
 * Admins  /adminpanel/admins
 * APIs needed:
 *   GET    /admin/admins?page=&per_page=
 *          → { admins:[{ id, full_name, email, is_super_admin, last_login, created_at }], total }
 *   POST   /admin/admins   body: { full_name, email, password }  → create admin
 *   DELETE /admin/admins/:id                                      → revoke admin (sets is_admin=false)
 *   POST   /admin/admins/:id/reset-password  body: { new_password }
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ModalWithFooter, ConfirmDialog, Pagination, DetailRow } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = (json = false) => ({ Authorization: `Bearer ${tok()}`, ...(json ? { 'Content-Type': 'application/json' } : {}) });

type Admin = {
  id: number; full_name: string; email: string;
  is_super_admin?: boolean; last_login?: string; created_at?: string;
};

export default function AdminsPage() {
  const router = useRouter();
  const [admins,   setAdmins]   = useState<Admin[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [showReset, setShowReset] = useState<Admin | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const [selfId,   setSelfId]   = useState<number | null>(null);
  const perPage = 20;

  // Identify self so we can prevent self-revoke
  useEffect(() => {
    fetch(`${API}/auth/me`, { headers: hdr() })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.id) setSelfId(j.id); })
      .catch(() => {});
  }, []); // eslint-disable-line

  const load = useCallback(async (pg = page) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/admin/admins?page=${pg}&per_page=${perPage}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setAdmins(Array.isArray(j.admins) ? j.admins : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page]); // eslint-disable-line

  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  const doRevoke = async (id: number) => {
    await fetch(`${API}/admin/admins/${id}`, { method: 'DELETE', headers: hdr() });
    load(page);
  };

  const initials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Admin Accounts</div>
          <div className="adm-ph-sub">Manage who has admin access to this panel · {total} admins</div>
        </div>
        <div className="adm-ph-actions">
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setShowAdd(true)}>
            + Add Admin
          </button>
        </div>
      </div>

      {/* Security notice */}
      <div style={{ background: 'var(--ayd)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--r)', padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ay)' }}>Admin access is sensitive</div>
          <div style={{ fontSize: 12, color: 'var(--at2)', marginTop: 2 }}>Only grant admin access to trusted team members. All admin actions are logged. You cannot revoke your own access.</div>
        </div>
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last Login</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(4).fill(0).map((_, i) => (
                <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div className="adm-sk" style={{ height: 13, width: j === 0 ? 140 : 90 }} /></td>)}</tr>
              )) : admins.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="adm-empty">
                    <div className="adm-empty-icon">⬡</div>
                    <div className="adm-empty-title">No admins found</div>
                  </div>
                </td></tr>
              ) : admins.map(a => {
                const isSelf = a.id === selfId;
                return (
                  <tr key={a.id} style={isSelf ? { background: 'var(--acd2)' } : {}}>
                    <td>
                      <div className="adm-row adm-g2">
                        <div className="adm-av" style={{ background: 'linear-gradient(135deg,var(--acc),#c2410c)' }}>
                          {initials(a.full_name)}
                        </div>
                        <div>
                          <div className="td-bold">{a.full_name} {isSelf && <span style={{ fontSize: 10, color: 'var(--acc)', fontWeight: 700 }}>(you)</span>}</div>
                        </div>
                      </div>
                    </td>
                    <td className="adm-mono" style={{ fontSize: 12 }}>{a.email}</td>
                    <td>
                      <span className={`adm-badge ${a.is_super_admin ? 'orange' : 'blue'}`}>
                        {a.is_super_admin ? '⬡ Super Admin' : '◎ Admin'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {a.last_login ? new Date(a.last_login).toLocaleString() : <span style={{ color: 'var(--at3)' }}>Never</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="adm-row adm-g2">
                        <button className="adm-btn adm-btn-info adm-btn-sm"
                          onClick={() => setShowReset(a)}>
                          Reset PW
                        </button>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          disabled={isSelf}
                          title={isSelf ? 'Cannot revoke your own access' : ''}
                          onClick={() => !isSelf && setConfirm({
                            msg: `Revoke admin access for ${a.full_name}? They will no longer be able to log in to the admin panel.`,
                            fn: () => { setConfirm(null); doRevoke(a.id); }
                          })}>
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} perPage={perPage} onPage={setPage} />
      </div>

      {showAdd  && <AddAdminModal  onClose={() => setShowAdd(false)}   onSaved={() => { setShowAdd(false);   load(1); }} />}
      {showReset && <ResetPwModal  admin={showReset} onClose={() => setShowReset(null)} />}
      {confirm  && <ConfirmDialog  title="Revoke Access" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}

/* ── Add Admin modal ── */
function AddAdminModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name,     setName]    = useState('');
  const [email,    setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [saving,   setSaving]  = useState(false);
  const [err,      setErr]     = useState('');
  const [showPw,   setShowPw]  = useState(false);

  const save = async () => {
    if (!name || !email || !password) { setErr('All fields are required.'); return; }
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch(`${API}/admin/admins`, {
        method: 'POST', headers: hdr(true),
        body: JSON.stringify({ full_name: name, email, password }),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <ModalWithFooter
      title="Add New Admin"
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving}>
            {saving ? '⏳ Creating…' : 'Create Admin Account'}
          </button>
        </>
      }
    >
      {err && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontSize: 12 }}>⚠ {err}</div>}
      <div className="adm-field">
        <label className="adm-label">Full Name</label>
        <input className="adm-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya Sharma" autoFocus />
      </div>
      <div className="adm-field">
        <label className="adm-label">Email Address</label>
        <input className="adm-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="priya@gharkachef.com" />
      </div>
      <div className="adm-field">
        <label className="adm-label">Temporary Password</label>
        <div style={{ position: 'relative' }}>
          <input className="adm-input" type={showPw ? 'text' : 'password'}
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 characters" style={{ paddingRight: 40 }} />
          <button type="button" onClick={() => setShowPw(p => !p)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--at3)', cursor: 'pointer', fontSize: 13 }}>
            {showPw ? '🙈' : '👁'}
          </button>
        </div>
      </div>
      <div style={{ background: 'var(--abd)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--abl)' }}>
        ℹ The new admin will receive full panel access. Ask them to change their password after first login.
      </div>
    </ModalWithFooter>
  );
}

/* ── Reset password modal ── */
function ResetPwModal({ admin, onClose }: { admin: Admin; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm2, setConfirm2] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');
  const [done,     setDone]     = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  const save = async () => {
    if (!password) { setErr('Enter a new password.'); return; }
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (password !== confirm2) { setErr('Passwords do not match.'); return; }
    setSaving(true); setErr('');
    try {
      const r = await fetch(`${API}/admin/admins/${admin.id}/reset-password`, {
        method: 'POST', headers: hdr(true),
        body: JSON.stringify({ new_password: password }),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <ModalWithFooter
      title={`Reset Password — ${admin.full_name}`}
      onClose={onClose}
      footer={done
        ? <button className="adm-btn adm-btn-primary" onClick={onClose}>Done</button>
        : <>
            <button className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving}>
              {saving ? '⏳ Saving…' : 'Reset Password'}
            </button>
          </>
      }
    >
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ag)' }}>Password reset successfully</div>
          <div style={{ fontSize: 12, color: 'var(--at3)', marginTop: 6 }}>Share the new password with {admin.full_name} securely.</div>
        </div>
      ) : (
        <>
          {err && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontSize: 12 }}>⚠ {err}</div>}
          <div className="adm-field">
            <label className="adm-label">New Password</label>
            <div style={{ position: 'relative' }}>
              <input className="adm-input" type={showPw ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters" style={{ paddingRight: 40 }} autoFocus />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--at3)', cursor: 'pointer', fontSize: 13 }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className="adm-field">
            <label className="adm-label">Confirm Password</label>
            <input className="adm-input" type="password" value={confirm2} onChange={e => setConfirm2(e.target.value)} placeholder="Re-enter password" />
          </div>
        </>
      )}
    </ModalWithFooter>
  );
}
