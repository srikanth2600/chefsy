'use client';
/**
 * Chefs & Professionals  /adminpanel/chefs
 * APIs needed:
 *   GET    /admin/chefs?q=&status=&page=&per_page=
 *          → { chefs:[{ id, full_name, email, phone, designation, cuisine_speciality,
 *                       experience_years, location, bio, is_verified, is_featured,
 *                       is_active, rating, review_count, recipe_count, created_at }], total }
 *   POST   /admin/chefs/:id/verify    → toggle verified badge
 *   POST   /admin/chefs/:id/feature   → toggle featured on home
 *   POST   /admin/chefs/:id/activate  → toggle active/suspend
 *   DELETE /admin/chefs/:id
 *   GET    /admin/chefs/:id           → full profile + recent recipes
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ConfirmDialog, Pagination, DetailRow } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type Chef = {
  id: number; full_name: string; email: string; phone?: string;
  designation?: string; cuisine_speciality?: string; experience_years?: number;
  location?: string; bio?: string;
  is_verified?: boolean; is_featured?: boolean; is_active?: boolean;
  rating?: number; review_count?: number; recipe_count?: number;
  created_at?: string;
};

const STARS = (n = 0) => {
  const full = Math.floor(n); const half = n % 1 >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
};

export default function ChefsPage() {
  const router = useRouter();
  const [chefs,    setChefs]    = useState<Chef[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [q,        setQ]        = useState('');
  const [status,   setStatus]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<Chef | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const perPage = 15;

  const load = useCallback(async (pg = page) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (q)      p.set('q',      q);
      if (status) p.set('status', status);
      const r = await fetch(`${API}/admin/chefs?${p}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setChefs(Array.isArray(j.chefs) ? j.chefs : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, q, status]); // eslint-disable-line

  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  const doAction = async (path: string) => {
    await fetch(`${API}${path}`, { method: 'POST', headers: hdr() });
    load(page);
    setSelected(null);
  };
  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/chefs/${id}`, { method: 'DELETE', headers: hdr() });
    setSelected(null); load(page);
  };

  const initials = (name: string) => name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  // Summary counts
  const verified  = chefs.filter(c => c.is_verified).length;
  const featured  = chefs.filter(c => c.is_featured).length;
  const suspended = chefs.filter(c => c.is_active === false).length;

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Chefs & Professionals</div>
          <div className="adm-ph-sub">Manage registered chefs and food professionals · {total} total</div>
        </div>
      </div>

      {/* Mini summary */}
      <div className="adm-stats adm-mb3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
        {[
          { color: 'c-orange', icon: '👨‍🍳', label: 'Total Chefs',   value: total },
          { color: 'c-green',  icon: '✓',   label: 'Verified',      value: verified },
          { color: 'c-purple', icon: '★',   label: 'Featured',      value: featured },
          { color: 'c-red',    icon: '⊘',   label: 'Suspended',     value: suspended },
        ].map((s, i) => (
          <div key={i} className={`adm-stat ${s.color}`}>
            <div className="adm-stat-icon" style={{ fontSize: 18 }}>{s.icon}</div>
            <div className="adm-stat-val">{loading ? <span className="adm-sk" style={{ display: 'block', height: 24, width: 40 }} /> : s.value}</div>
            <div className="adm-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      <div className="adm-filters">
        <input className="adm-input" placeholder="Search name, email, location, cuisine…" value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1))} />
        <select className="adm-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
          <option value="">All chefs</option>
          <option value="verified">Verified only</option>
          <option value="featured">Featured only</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => { setPage(1); load(1); }}>Search</button>
        {(q || status) && <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setQ(''); setStatus(''); setPage(1); load(1); }}>Clear</button>}
      </div>

      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Chef</th>
                <th>Designation</th>
                <th>Speciality</th>
                <th>Location</th>
                <th>Rating</th>
                <th>Recipes</th>
                <th>Badges</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="adm-sk" style={{ height: 13, width: j === 0 ? 140 : 80 }} /></td>)}</tr>
              )) : chefs.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="adm-empty">
                    <div className="adm-empty-icon">👨‍🍳</div>
                    <div className="adm-empty-title">No chefs found</div>
                    <div>Chefs register with user_type = 'chef'</div>
                  </div>
                </td></tr>
              ) : chefs.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="adm-row adm-g2">
                      <div className="adm-av" style={{ background: 'linear-gradient(135deg,#a855f7,#7c3aed)' }}>
                        {initials(c.full_name)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="td-bold adm-truncate" style={{ maxWidth: 130 }}>{c.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--at3)' }} className="adm-truncate">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{c.designation || '—'}</td>
                  <td>{c.cuisine_speciality ? <span className="adm-tag">{c.cuisine_speciality}</span> : '—'}</td>
                  <td style={{ fontSize: 12 }}>{c.location || '—'}</td>
                  <td>
                    {c.rating != null ? (
                      <div>
                        <span style={{ color: 'var(--ay)', fontSize: 11 }}>★</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--at)', marginLeft: 3 }}>{c.rating.toFixed(1)}</span>
                        <span style={{ fontSize: 11, color: 'var(--at3)', marginLeft: 3 }}>({c.review_count ?? 0})</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--fm)', fontSize: 13 }}>{c.recipe_count ?? 0}</td>
                  <td>
                    <div className="adm-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {c.is_verified  && <span className="adm-badge green">✓ Verified</span>}
                      {c.is_featured  && <span className="adm-badge purple">★ Featured</span>}
                      {c.is_active === false && <span className="adm-badge red">⊘ Suspended</span>}
                      {c.is_active !== false && !c.is_verified && <span className="adm-badge gray">Pending</span>}
                    </div>
                  </td>
                  <td>
                    <div className="adm-row adm-g2">
                      <button className="adm-btn adm-btn-info adm-btn-sm" onClick={() => setSelected(c)}>View</button>
                      <button className={`adm-btn adm-btn-sm ${c.is_verified ? 'adm-btn-ghost' : 'adm-btn-success'}`}
                        onClick={() => doAction(`/admin/chefs/${c.id}/verify`)}>
                        {c.is_verified ? 'Unverify' : 'Verify'}
                      </button>
                      <button className={`adm-btn adm-btn-sm ${c.is_active === false ? 'adm-btn-success' : 'adm-btn-warn'}`}
                        onClick={() => setConfirm({
                          msg: `${c.is_active === false ? 'Restore' : 'Suspend'} ${c.full_name}?`,
                          fn: () => { setConfirm(null); doAction(`/admin/chefs/${c.id}/activate`); }
                        })}>
                        {c.is_active === false ? 'Restore' : 'Suspend'}
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

      {/* Chef detail modal */}
      {selected && (
        <Modal title={`Chef — ${selected.full_name}`} onClose={() => setSelected(null)}>
          {/* Profile header */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '4px 0 16px', borderBottom: '1px solid var(--ae)', marginBottom: 4 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {selected.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 700, color: 'var(--at)' }}>{selected.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--at3)' }}>{selected.designation || 'Chef'} {selected.location ? `· ${selected.location}` : ''}</div>
              {selected.rating != null && (
                <div style={{ fontSize: 12, color: 'var(--ay)', marginTop: 2 }}>
                  ★ {selected.rating.toFixed(1)} <span style={{ color: 'var(--at3)' }}>({selected.review_count} reviews)</span>
                </div>
              )}
            </div>
          </div>

          <DetailRow label="Email"       value={<span className="adm-mono">{selected.email}</span>} />
          <DetailRow label="Phone"       value={selected.phone} />
          <DetailRow label="Speciality"  value={selected.cuisine_speciality} />
          <DetailRow label="Experience"  value={selected.experience_years ? `${selected.experience_years} years` : undefined} />
          <DetailRow label="Location"    value={selected.location} />
          <DetailRow label="Recipes"     value={selected.recipe_count} />
          {selected.bio && <DetailRow label="Bio" value={<span style={{ fontStyle: 'italic', color: 'var(--at2)' }}>{selected.bio}</span>} />}
          <DetailRow label="Verified"    value={selected.is_verified  ? '✅ Yes' : '❌ No'} />
          <DetailRow label="Featured"    value={selected.is_featured  ? '✅ Yes' : 'No'} />
          <DetailRow label="Status"      value={selected.is_active === false ? '🚫 Suspended' : '✅ Active'} />
          <DetailRow label="Joined"      value={selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'} />

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button className={`adm-btn adm-btn-sm ${selected.is_verified ? 'adm-btn-ghost' : 'adm-btn-success'}`}
              onClick={() => doAction(`/admin/chefs/${selected.id}/verify`)}>
              {selected.is_verified ? '✓ Remove Verification' : '✓ Verify Chef'}
            </button>
            <button className={`adm-btn adm-btn-sm ${selected.is_featured ? 'adm-btn-ghost' : 'adm-btn-warn'}`}
              onClick={() => doAction(`/admin/chefs/${selected.id}/feature`)}>
              {selected.is_featured ? '★ Unfeature' : '★ Feature on Home'}
            </button>
            <button className="adm-btn adm-btn-danger adm-btn-sm"
              onClick={() => setConfirm({ msg: `Permanently delete ${selected.full_name}?`, fn: () => { setConfirm(null); doDelete(selected.id); } })}>
              Delete
            </button>
          </div>
        </Modal>
      )}

      {confirm && <ConfirmDialog title="Confirm Action" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}
