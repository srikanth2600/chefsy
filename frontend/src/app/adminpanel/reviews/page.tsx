'use client';

/**
 * /adminpanel/reviews
 * Admin view of all recipe reviews across all chefs.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pagination } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type Review = {
  id: number;
  rating: number;
  review_text?: string;
  created_at: string;
  recipe_id: number;
  recipe_title: string;
  reviewer_name: string;
  reviewer_email?: string;
  chef_name: string;
  chef_id?: number;
};

const Stars = ({ n }: { n: number }) => (
  <span style={{ color: 'var(--ao)', letterSpacing: 1, fontSize: 13 }}>
    {'★'.repeat(n)}{'☆'.repeat(5 - n)}
  </span>
);

const RatingBadge = ({ n }: { n: number }) => {
  const colors: Record<number, string> = { 5: 'c-green', 4: 'c-green', 3: 'c-orange', 2: 'c-red', 1: 'c-red' };
  return <span className={`adm-badge ${colors[n] || 'c-orange'}`}>{n}★</span>;
};

export default function ReviewsAdminPage() {
  const router = useRouter();
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState('');
  const [chefId, setChefId]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const perPage = 20;

  const load = useCallback(async (pg = 1) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (q)      p.set('q',       q);
      if (chefId) p.set('chef_id', chefId);
      const r = await fetch(`${API}/admin/reviews?${p}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setReviews(Array.isArray(j.reviews) ? j.reviews : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
      setPage(pg);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [q, chefId]); // eslint-disable-line

  useEffect(() => { load(1); }, []); // eslint-disable-line

  const doDelete = async (id: number) => {
    if (!confirm('Delete this review permanently?')) return;
    setDeleting(id);
    try {
      await fetch(`${API}/admin/reviews/${id}`, { method: 'DELETE', headers: hdr() });
      if (selected?.id === id) setSelected(null);
      await load(page);
    } finally { setDeleting(null); }
  };

  // Stat breakdown
  const avg  = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—';
  const dist = [5, 4, 3, 2, 1].map(n => ({ star: n, count: reviews.filter(r => r.rating === n).length }));

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">⭐ Reviews</div>
          <div className="adm-ph-sub">All recipe reviews submitted by users · {total} total</div>
        </div>
      </div>

      {/* Stats */}
      <div className="adm-stats adm-mb3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
        {[
          { color: 'c-orange', icon: '⭐', label: 'Total Reviews',   value: total },
          { color: 'c-yellow', icon: '★',  label: 'Avg Rating',      value: avg },
          { color: 'c-green',  icon: '↑',  label: '5-star Reviews',  value: dist[0].count },
          { color: 'c-red',    icon: '↓',  label: '1-star Reviews',  value: dist[4].count },
        ].map((s, i) => (
          <div key={i} className={`adm-stat ${s.color}`}>
            <div className="adm-stat-icon" style={{ fontSize: 18 }}>{s.icon}</div>
            <div className="adm-stat-val">{loading ? <span className="adm-sk" style={{ display: 'block', height: 24, width: 40 }} /> : s.value}</div>
            <div className="adm-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* Filters */}
      <div className="adm-filters">
        <input
          className="adm-input"
          placeholder="Search reviewer, recipe title, review text…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1)}
        />
        <input
          className="adm-input"
          placeholder="Filter by Chef ID"
          value={chefId}
          onChange={e => setChefId(e.target.value)}
          style={{ width: 160 }}
        />
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => load(1)}>Search</button>
        {(q || chefId) && (
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setQ(''); setChefId(''); load(1); }}>
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
                <th>Reviewer</th>
                <th>Recipe</th>
                <th>Chef</th>
                <th>Rating</th>
                <th>Review</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--at3)' }}>Loading…</td></tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--at3)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⭐</div>
                    No reviews found
                  </td>
                </tr>
              ) : reviews.map(r => (
                <tr
                  key={r.id}
                  className={selected?.id === r.id ? 'adm-row-selected' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(selected?.id === r.id ? null : r)}
                >
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.reviewer_name}</div>
                    {r.reviewer_email && <div style={{ fontSize: 11, color: 'var(--at3)' }}>{r.reviewer_email}</div>}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--ao)', fontSize: 13 }}>
                      {r.recipe_title}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--at3)' }}>ID: {r.recipe_id}</div>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--at2)' }}>
                    {r.chef_name || <span style={{ color: 'var(--at3)' }}>—</span>}
                  </td>
                  <td><RatingBadge n={r.rating} /></td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--at2)', display: 'block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.review_text || <span style={{ color: 'var(--at3)', fontStyle: 'italic' }}>No text</span>}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--at3)', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      style={{ color: 'var(--ar)' }}
                      disabled={deleting === r.id}
                      onClick={() => doDelete(r.id)}
                    >
                      {deleting === r.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail drawer */}
        {selected && (
          <div style={{
            borderTop: '1px solid var(--ab)',
            padding: '18px 20px',
            background: 'var(--as)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                  Review by <span style={{ color: 'var(--ao)' }}>{selected.reviewer_name}</span>
                  {' '}on <span style={{ color: 'var(--ao)' }}>{selected.recipe_title}</span>
                </div>
                <Stars n={selected.rating} />
                <span style={{ fontSize: 11, color: 'var(--at3)', marginLeft: 8 }}>
                  {new Date(selected.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--at3)', fontSize: 20 }}
              >
                ×
              </button>
            </div>
            <div style={{
              background: 'var(--ab2)',
              border: '1px solid var(--ab)',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 13,
              color: 'var(--at2)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}>
              {selected.review_text || <span style={{ fontStyle: 'italic', color: 'var(--at3)' }}>No review text provided.</span>}
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                style={{ color: 'var(--ar)' }}
                onClick={() => doDelete(selected.id)}
              >
                Delete Review
              </button>
            </div>
          </div>
        )}

        <Pagination page={page} total={total} perPage={perPage} onChange={p => { setPage(p); load(p); }} />
      </div>
    </>
  );
}