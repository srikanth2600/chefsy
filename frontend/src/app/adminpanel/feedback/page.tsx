'use client';
/**
 * Feedback  /adminpanel/feedback
 * APIs needed:
 *   GET /admin/feedback?type=&page=&per_page=   → { items:[{id,user_id,user_name,recipe_key,recipe_title,
 *                                                           type(like|dislike),comment,created_at}], total }
 *   DELETE /admin/feedback/:id
 *   GET /admin/feedback/summary                 → { total_likes, total_dislikes, most_liked:[...], most_disliked:[...] }
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog, Pagination } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type FeedbackItem = {
  id: number; user_id?: number; user_name?: string;
  recipe_key?: string; recipe_title?: string;
  type: 'like' | 'dislike'; comment?: string; created_at?: string;
};
type Summary = {
  total_likes: number; total_dislikes: number;
  most_liked:    { title: string; likes: number }[];
  most_disliked: { title: string; dislikes: number }[];
};

export default function FeedbackPage() {
  const router = useRouter();
  const [items,    setItems]    = useState<FeedbackItem[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [type,     setType]     = useState('');
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const perPage = 20;

  const load = useCallback(async (pg = page) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (type) p.set('type', type);
      const [r1, r2] = await Promise.all([
        fetch(`${API}/admin/feedback?${p}`,          { headers: hdr() }),
        fetch(`${API}/admin/feedback/summary`,        { headers: hdr() }),
      ]);
      if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
      const j1 = await r1.json();
      const j2 = r2.ok ? await r2.json() : null;
      setItems(Array.isArray(j1.items) ? j1.items : []);
      setTotal(typeof j1.total === 'number' ? j1.total : 0);
      if (j2) setSummary(j2);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, type]); // eslint-disable-line

  useEffect(() => { load(page); }, [page, type]); // eslint-disable-line

  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/feedback/${id}`, { method: 'DELETE', headers: hdr() });
    load(page);
  };

  const likeRate = summary ? Math.round((summary.total_likes / (summary.total_likes + summary.total_dislikes || 1)) * 100) : 0;

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Feedback & Ratings</div>
          <div className="adm-ph-sub">User reactions across all recipes</div>
        </div>
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      {/* Summary cards */}
      <div className="adm-stats adm-mb3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
        <div className="adm-stat c-green">
          <div className="adm-stat-icon">👍</div>
          <div className="adm-stat-val">{loading ? <span className="adm-sk" style={{ display: 'block', height: 24, width: 50 }} /> : (summary?.total_likes ?? 0)}</div>
          <div className="adm-stat-label">Total Likes</div>
        </div>
        <div className="adm-stat c-red">
          <div className="adm-stat-icon">👎</div>
          <div className="adm-stat-val">{loading ? <span className="adm-sk" style={{ display: 'block', height: 24, width: 50 }} /> : (summary?.total_dislikes ?? 0)}</div>
          <div className="adm-stat-label">Total Dislikes</div>
        </div>
        <div className="adm-stat c-orange">
          <div className="adm-stat-icon">★</div>
          <div className="adm-stat-val">{loading ? '—' : `${likeRate}%`}</div>
          <div className="adm-stat-label">Like Rate</div>
        </div>
        <div className="adm-stat c-blue">
          <div className="adm-stat-icon">✦</div>
          <div className="adm-stat-val">{loading ? '—' : total}</div>
          <div className="adm-stat-label">Total Reactions</div>
        </div>
      </div>

      {/* Most liked / disliked */}
      {summary && (
        <div className="adm-grid2 adm-mb3" style={{ gap: 14 }}>
          <div className="adm-card">
            <div className="adm-card-hd"><span className="adm-card-title">👍 Most Liked Recipes</span></div>
            <div className="adm-card-bd" style={{ padding: '8px 18px 14px' }}>
              {summary.most_liked.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < summary.most_liked.length - 1 ? '1px solid var(--ae)' : 'none' }}>
                  <span style={{ width: 18, fontSize: 11, color: 'var(--at3)', fontFamily: 'var(--fm)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--at)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  <span style={{ color: 'var(--ag)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>+{r.likes}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="adm-card">
            <div className="adm-card-hd"><span className="adm-card-title">👎 Most Disliked Recipes</span></div>
            <div className="adm-card-bd" style={{ padding: '8px 18px 14px' }}>
              {summary.most_disliked.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < summary.most_disliked.length - 1 ? '1px solid var(--ae)' : 'none' }}>
                  <span style={{ width: 18, fontSize: 11, color: 'var(--at3)', fontFamily: 'var(--fm)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--at)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  <span style={{ color: 'var(--ar)', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>-{r.dislikes}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reactions table */}
      <div className="adm-filters">
        <button className={`adm-btn adm-btn-sm ${type === '' ? 'adm-btn-primary' : 'adm-btn-ghost'}`} onClick={() => { setType(''); setPage(1); }}>All</button>
        <button className={`adm-btn adm-btn-sm ${type === 'like' ? 'adm-btn-success' : 'adm-btn-ghost'}`} onClick={() => { setType('like'); setPage(1); }}>👍 Likes</button>
        <button className={`adm-btn adm-btn-sm ${type === 'dislike' ? 'adm-btn-danger' : 'adm-btn-ghost'}`} onClick={() => { setType('dislike'); setPage(1); }}>👎 Dislikes</button>
      </div>

      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Reaction</th>
                <th>User</th>
                <th>Recipe</th>
                <th>Comment</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div className="adm-sk" style={{ height: 13, width: j === 2 ? 160 : 80 }} /></td>)}</tr>
              )) : items.length === 0 ? (
                <tr><td colSpan={6}><div className="adm-empty"><div className="adm-empty-icon">✦</div><div className="adm-empty-title">No feedback found</div></div></td></tr>
              ) : items.map(item => (
                <tr key={item.id}>
                  <td><span className={`adm-badge ${item.type === 'like' ? 'green' : 'red'}`}>{item.type === 'like' ? '👍 Like' : '👎 Dislike'}</span></td>
                  <td style={{ fontSize: 12 }}>{item.user_name || `#${item.user_id}`}</td>
                  <td className="td-bold adm-truncate" style={{ maxWidth: 200 }}>{item.recipe_title || item.recipe_key || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--at3)', maxWidth: 200 }} className="adm-truncate">{item.comment || '—'}</td>
                  <td style={{ fontSize: 12 }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button className="adm-btn adm-btn-danger adm-btn-sm"
                      onClick={() => setConfirm({ msg: `Remove this reaction?`, fn: () => { setConfirm(null); doDelete(item.id); } })}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} perPage={perPage} onPage={setPage} />
      </div>

      {confirm && <ConfirmDialog title="Confirm" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}
