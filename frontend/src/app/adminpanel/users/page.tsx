'use client';
/**
 * Users  /adminpanel/users
 * APIs:
 *   GET  /admin/users?q=&page=&per_page=    → { users:[...], total }
 *   POST /admin/users/:id/block             → toggle block
 *   DELETE /admin/users/:id                 → delete user
 *   GET  /admin/users/:id                   → user detail
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ConfirmDialog, Pagination, DetailRow } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type User = {
  id: number; full_name: string; email: string; phone?: string;
  user_type?: string; is_verified?: boolean; is_admin?: boolean;
  designation?: string; created_at?: string; is_blocked?: boolean;
  recipe_count?: number; chat_count?: number;
};

const ROLES = ['', 'user', 'chef', 'admin'];
const USER_TYPES = ['', 'Chef', 'Restaurant/Foodcourt', 'Working Professional', 'House Wife', 'Freelance', 'Student', 'Business', 'Other'];
const STATUS = ['', 'active', 'blocked'];

export default function UsersPage() {
  const router = useRouter();
  const [users,   setUsers]   = useState<User[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [q,       setQ]       = useState('');
  const [role,    setRole]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const perPage = 15;

  const load = useCallback(async (pg = page) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (q)    p.set('q',    q);
      if (role) p.set('role', role);
      const r = await fetch(`${API}/admin/users?${p}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setUsers(Array.isArray(j.users) ? j.users : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, q, role]);  // eslint-disable-line

  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  const doBlock = async (u: User) => {
    await fetch(`${API}/admin/users/${u.id}/block`, { method: 'POST', headers: hdr() });
    load(page);
  };
  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: hdr() });
    setSelected(null); load(page);
  };
  const doUpdate = async (u: User) => {
    await fetch(`${API}/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { ...hdr(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_type: u.user_type }),
    });
    load(page);
  };

  const initials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Users</div>
          <div className="adm-ph-sub">Manage all registered users · {total} total</div>
        </div>
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      {/* Filters */}
      <div className="adm-filters">
        <input className="adm-input" placeholder="Search name, email, phone…" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1))} />
        <select className="adm-select" value={role} onChange={e => setRole(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
          <option value="">All roles</option>
          {ROLES.filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => { setPage(1); load(1); }}>
          Search
        </button>
        {(q || role) && (
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setQ(''); setRole(''); setPage(1); load(1); }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <td key={j}><div className="adm-sk" style={{ height: 14, width: j === 0 ? 120 : 80 }} /></td>
                  ))}
                </tr>
              )) : users.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="adm-empty"><div className="adm-empty-icon">◎</div><div className="adm-empty-title">No users found</div></div>
                </td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="adm-row adm-g2">
                      <div className="adm-av">{initials(u.full_name)}</div>
                      <span className="td-bold adm-truncate" style={{ maxWidth: 140 }}>{u.full_name}</span>
                    </div>
                  </td>
                  <td className="adm-mono">{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>
                    <span className={`adm-badge ${u.is_admin ? 'orange' : u.user_type === 'chef' ? 'purple' : 'gray'}`}>
                      {u.is_admin ? 'admin' : u.user_type || 'user'}
                    </span>
                  </td>
                  <td>
                    <span className={`adm-badge ${u.is_blocked ? 'red' : u.is_verified ? 'green' : 'yellow'}`}>
                      {u.is_blocked ? 'blocked' : u.is_verified ? 'active' : 'unverified'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div className="adm-row adm-g2">
                      <button className="adm-btn adm-btn-info adm-btn-sm" onClick={() => setSelected(u)}>View</button>
                      <button className={`adm-btn adm-btn-sm ${u.is_blocked ? 'adm-btn-success' : 'adm-btn-warn'}`}
                        onClick={() => setConfirm({ msg: `${u.is_blocked ? 'Unblock' : 'Block'} ${u.full_name}?`, fn: () => { setConfirm(null); doBlock(u); } })}>
                        {u.is_blocked ? 'Unblock' : 'Block'}
                      </button>
                      <button className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() => setConfirm({ msg: `Permanently delete ${u.full_name}? This cannot be undone.`, fn: () => { setConfirm(null); doDelete(u.id); } })}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} perPage={perPage} onPage={setPage} />
      </div>

      {/* User detail modal */}
      {selected && (
        <Modal title={`User — ${selected.full_name}`} onClose={() => setSelected(null)}>
          <DetailRow label="ID"          value={<span className="adm-mono">#{selected.id}</span>} />
          <DetailRow label="Full Name"   value={selected.full_name} />
          <DetailRow label="Email"       value={<span className="adm-mono">{selected.email}</span>} />
          <DetailRow label="Phone"       value={selected.phone} />
          <DetailRow label="Role"        value={selected.user_type || 'user'} />
          <DetailRow label="Admin"       value={selected.is_admin ? '✅ Yes' : 'No'} />
          <DetailRow label="Verified"    value={selected.is_verified ? '✅ Yes' : '❌ No'} />
          <DetailRow label="Status"      value={selected.is_blocked ? '🚫 Blocked' : '✅ Active'} />
          <DetailRow label="Joined"      value={selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'} />
          {selected.recipe_count != null && <DetailRow label="Recipes"   value={selected.recipe_count} />}
          {selected.chat_count   != null && <DetailRow label="Chats"     value={selected.chat_count} />}
          <div style={{ marginTop: 12 }}>
            <div className="adm-label" style={{ marginBottom: 6 }}>User Type</div>
            <select
              className="adm-select"
              value={selected.user_type || ''}
              onChange={e => setSelected({ ...selected, user_type: e.target.value })}
            >
              {USER_TYPES.map(t => (
                <option key={t || 'empty'} value={t}>{t || 'Select'}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="adm-btn adm-btn-primary adm-btn-sm"
              onClick={() => { doUpdate(selected); }}>
              Save
            </button>
            <button className={`adm-btn ${selected.is_blocked ? 'adm-btn-success' : 'adm-btn-warn'} adm-btn-sm`}
              onClick={() => { doBlock(selected); setSelected(null); }}>
              {selected.is_blocked ? 'Unblock User' : 'Block User'}
            </button>
            <button className="adm-btn adm-btn-danger adm-btn-sm"
              onClick={() => setConfirm({ msg: `Delete ${selected.full_name}?`, fn: () => { setConfirm(null); doDelete(selected.id); } })}>
              Delete User
            </button>
          </div>
        </Modal>
      )}

      {confirm && <ConfirmDialog title="Confirm Action" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}
