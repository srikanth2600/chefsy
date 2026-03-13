'use client';
/**
 * Videos  /adminpanel/videos
 * APIs:
 *   GET    /admin/videos?q=&status=&page=&per_page=   → { videos:[...], total }
 *   POST   /admin/videos/:id/approve                  → approve
 *   POST   /admin/videos/:id/reject                   → reject
 *   DELETE /admin/videos/:id                          → delete
 *   POST   /admin/videos          body: { url, title, category, keywords[], thumbnail, channel }
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ModalWithFooter, ConfirmDialog, Pagination, DetailRow } from '../components/Shared';
import { createVideoApi, updateVideoApi } from './api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = (json = false) => ({ Authorization: `Bearer ${tok()}`, ...(json ? { 'Content-Type': 'application/json' } : {}) });
const ytId = (url: string) => { try { return new URL(url).searchParams.get('v') || url.split('/').pop()?.split('?')[0] || ''; } catch { return ''; } };

type Video = {
  id: number; user_id?: number; recipe_id?: number; url: string;
  title?: string; category?: string; keywords_json?: string[]; keywords?: string;
  thumbnail?: string; channel?: string; watch_count?: number;
  status?: string; created_at?: string;
};

export default function VideosPage() {
  const router = useRouter();
  const [videos,   setVideos]   = useState<Video[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [q,        setQ]        = useState('');
  const [status,   setStatus]   = useState('');
  const [recipeFilter, setRecipeFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc'|'asc'>('desc');
  const [sortBy, setSortBy] = useState<'created_at'|'watch_count'>('created_at');
  const [dateRange, setDateRange] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<Video | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const perPage = 15;

  const load = useCallback(async (pg = page) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (q)      p.set('q',      q);
      if (status) p.set('status', status);
      if (recipeFilter) p.set('recipe_id', recipeFilter);
      if (sortOrder) p.set('order', sortOrder);
      if (sortBy) p.set('sort_by', sortBy);
        if (startDate) p.set('start_date', startDate);
        if (endDate) p.set('end_date', endDate);
      const r = await fetch(`${API}/admin/videos?${p}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setVideos(Array.isArray(j.videos) ? j.videos : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, q, status]); // eslint-disable-line

  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  const doApprove = async (id: number) => { await fetch(`${API}/admin/videos/${id}/approve`, { method: 'POST', headers: hdr() }); load(page); };
  const doReject  = async (id: number) => { await fetch(`${API}/admin/videos/${id}/reject`,  { method: 'POST', headers: hdr() }); load(page); };
  const doDelete  = async (id: number) => { await fetch(`${API}/admin/videos/${id}`,          { method: 'DELETE', headers: hdr() }); setSelected(null); load(page); };

  const statusColor: Record<string, string> = { approved: 'green', pending: 'yellow', rejected: 'red', active: 'green' };
  const pending = videos.filter(v => v.status === 'pending').length;
  const toggleActive = async (v: Video) => {
    if (!v) return;
    const target = v.status === 'active' ? 'inactive' : 'active';
    try {
      setToggling(v.id);
      await updateVideoApi(tok(), v.id, { status: target });
      await load(page);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setToggling(null);
    }
  };

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Videos</div>
          <div className="adm-ph-sub">Manage YouTube videos · {total} total{pending > 0 ? ` · ${pending} pending review` : ''}</div>
        </div>
        <div className="adm-ph-actions">
          {pending > 0 && (
            <button className="adm-btn adm-btn-warn adm-btn-sm" onClick={() => { setStatus('pending'); setPage(1); load(1); }}>
              ⚠ {pending} Pending
            </button>
          )}
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setShowAdd(true)}>
            + Add Video
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      <div className="adm-filters">
        <input className="adm-input" placeholder="Search title, channel, keywords…" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1))} />
        <input className="adm-input" placeholder="Filter by recipe id" value={recipeFilter} onChange={e => setRecipeFilter(e.target.value)} style={{ width: 160 }} />
        <select className="adm-select" value={sortBy} onChange={e => { setSortBy(e.target.value as 'created_at'|'watch_count'); setPage(1); }} style={{ width: 160 }}>
          <option value="created_at">Sort: Date</option>
          <option value="watch_count">Sort: Watches</option>
        </select>
        <select className="adm-select" value={sortOrder} onChange={e => { setSortOrder(e.target.value as 'asc'|'desc'); setPage(1); }} style={{ width: 140 }}>
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <select className="adm-select" value={dateRange} onChange={e => {
          const v = e.target.value; setDateRange(v); setPage(1);
          const today = new Date();
          let sd = '', ed = '';
          const toISO = (d: Date) => d.toISOString().slice(0,10);
          if (v === 'today') { sd = toISO(today); ed = sd; }
          else if (v === 'yesterday') { const d = new Date(today); d.setDate(today.getDate()-1); sd = toISO(d); ed = sd; }
          else if (v === 'this_week') { const d = new Date(today); const diff = d.getDay(); d.setDate(d.getDate()-diff); sd = toISO(d); ed = toISO(today); }
          else if (v === 'last_week') { const d = new Date(today); const diff = d.getDay()+7; d.setDate(d.getDate()-diff); const start = new Date(d); const end = new Date(d); end.setDate(start.getDate()+6); sd = toISO(start); ed = toISO(end); }
          else if (v === 'this_month') { const d = new Date(today.getFullYear(), today.getMonth(), 1); sd = toISO(d); ed = toISO(today); }
          else if (v === 'last_month') { const d = new Date(today.getFullYear(), today.getMonth()-1, 1); const end = new Date(today.getFullYear(), today.getMonth(), 0); sd = toISO(d); ed = toISO(end); }
          else if (v === 'custom') { sd = startDate; ed = endDate; }
          else { sd = ''; ed = ''; }
          setStartDate(sd); setEndDate(ed);
        }} style={{ width: 160, marginLeft: 8 }}>
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_week">This week</option>
          <option value="last_week">Last week</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="custom">Custom</option>
        </select>
        {dateRange === 'custom' && (
          <>
            <input type="date" className="adm-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: 150, marginLeft: 8 }} />
            <input type="date" className="adm-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: 150, marginLeft: 8 }} />
          </>
        )}
        <select className="adm-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => { setPage(1); load(1); }}>Search</button>
        {(q || status || recipeFilter) && <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setQ(''); setStatus(''); setRecipeFilter(''); setPage(1); load(1); }}>Clear</button>}
      </div>

      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Title</th>
                <th>Channel</th>
                <th>Category</th>
                <th>Watches</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="adm-sk" style={{ height: 13, width: j === 0 ? 60 : 90 }} /></td>)}</tr>
              )) : videos.length === 0 ? (
                <tr><td colSpan={8}><div className="adm-empty"><div className="adm-empty-icon">▶</div><div className="adm-empty-title">No videos found</div></div></td></tr>
              ) : videos.map(v => (
                <tr key={v.id}>
                  <td>
                    {v.thumbnail ? (
                      <img src={v.thumbnail} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 5, display: 'block' }} />
                    ) : ytId(v.url) ? (
                      <img src={`https://img.youtube.com/vi/${ytId(v.url)}/mqdefault.jpg`} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 5, display: 'block' }} />
                    ) : (
                      <div style={{ width: 64, height: 36, borderRadius: 5, background: 'var(--ab3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>▶</div>
                    )}
                  </td>
                  <td>
                    <div className="td-bold adm-truncate" style={{ maxWidth: 200 }}>{v.title || '—'}</div>
                    <a href={v.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--acc)', textDecoration: 'none' }}>
                      ↗ YouTube
                    </a>
                  </td>
                  <td style={{ fontSize: 12 }}>{v.channel || '—'}</td>
                  <td>{v.category ? <span className="adm-tag">{v.category}</span> : '—'}</td>
                  <td style={{ fontFamily: 'var(--fm)', fontSize: 13 }}>{v.watch_count ?? 0}</td>
                  <td><span className={`adm-badge ${statusColor[v.status || ''] || 'gray'}`}>{v.status || 'unknown'}</span></td>
                  <td style={{ fontSize: 12 }}>{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="adm-row adm-g2">
                      <button className="adm-btn adm-btn-info adm-btn-sm" onClick={() => setSelected(v)}>View</button>
                      <button
                        className={`adm-btn adm-btn-sm ${v.status === 'active' ? 'adm-btn-warn' : 'adm-btn-success'}`}
                        onClick={() => toggleActive(v)}
                        disabled={toggling === v.id}
                      >
                        {toggling === v.id ? '…' : (v.status === 'active' ? 'Deactivate' : 'Activate')}
                      </button>
                      {v.status === 'pending' && <>
                        <button className="adm-btn adm-btn-success adm-btn-sm" onClick={() => doApprove(v.id)}>✓</button>
                        <button className="adm-btn adm-btn-danger adm-btn-sm"  onClick={() => doReject(v.id)}>✕</button>
                      </>}
                      <button className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() => setConfirm({ msg: `Delete video "${v.title || v.id}"?`, fn: () => { setConfirm(null); doDelete(v.id); } })}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} perPage={perPage} onPage={setPage} />
      </div>

      {/* Detail modal */}
      {selected && (
        <ModalWithFooter
          title={selected.title || `Video #${selected.id}`}
          onClose={() => setSelected(null)}
          footer={
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setShowEdit(true)}>Edit</button>
                <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setPlaying(playing === selected.id ? null : selected.id)}>
                  {playing === selected.id ? 'Close Player' : 'Watch'}
                </button>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {selected.status === 'pending' && <>
                  <button className="adm-btn adm-btn-success adm-btn-sm" onClick={() => { doApprove(selected.id); setSelected(null); }}>✓ Approve</button>
                  <button className="adm-btn adm-btn-danger  adm-btn-sm" onClick={() => { doReject(selected.id);  setSelected(null); }}>✕ Reject</button>
                </>}
                <button className="adm-btn adm-btn-danger adm-btn-sm"
                  onClick={() => setConfirm({ msg: `Delete this video?`, fn: () => { setConfirm(null); doDelete(selected.id); } })}>Delete</button>
              </div>
            </>
          }
        >
          {(selected.thumbnail || ytId(selected.url)) && (
            <img
              src={selected.thumbnail || `https://img.youtube.com/vi/${ytId(selected.url)}/mqdefault.jpg`}
              alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 14, maxHeight: 180, objectFit: 'cover' }}
            />
          )}
          {playing === selected.id && ytId(selected.url) && (
            <div style={{ marginBottom: 12 }}>
              <iframe
                width="100%"
                height="315"
                src={`https://www.youtube.com/embed/${ytId(selected.url)}?rel=0`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ borderRadius: 8, marginBottom: 12 }}
              />
            </div>
          )}
          <DetailRow label="URL"       value={<a href={selected.url} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)' }}>{selected.url}</a>} />
          <DetailRow label="Channel"   value={selected.channel} />
          <DetailRow label="Category"  value={selected.category} />
          <DetailRow label="Keywords"  value={(selected.keywords_json ?? (selected.keywords ? [selected.keywords] : []))?.join(', ')} />
          <DetailRow label="Status"    value={<span className={`adm-badge ${statusColor[selected.status || ''] || 'gray'}`}>{selected.status}</span>} />
          <DetailRow label="Watches"   value={selected.watch_count} />
          <DetailRow label="Recipe ID" value={selected.recipe_id} />
          <DetailRow label="Added"     value={selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'} />
        </ModalWithFooter>
      )}
      {/* Edit modal */}
      {showEdit && selected && (
        <EditVideoModal
          video={selected}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); setSelected(null); load(1); }}
        />
      )}

      {/* Add video modal */}
      {showAdd && <AddVideoModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(1); }} />}

      {confirm && <ConfirmDialog title="Confirm" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}

function AddVideoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [url, setUrl]       = useState('');
  const [title, setTitle]   = useState('');
  const [category, setCat]  = useState('');
  const [keywords, setKw]   = useState('');
  const [channel, setCh]    = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const save = async () => {
    if (!url) { setErr('YouTube URL is required'); return; }
    setSaving(true); setErr('');
    try {
      await createVideoApi(tok(), { url, title, category, keywords: keywords.split(',').map(s => s.trim()).filter(Boolean), channel });
      onSaved();
    } catch (e: any) { setErr(e.message || String(e)); }
    finally { setSaving(false); }
  };

  return (
    <ModalWithFooter
      title="Add YouTube Video"
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving}>{saving ? '⏳ Saving…' : 'Add Video'}</button>
        </>
      }
    >
      {err && <div style={{ color: 'var(--ar)', fontSize: 12, marginBottom: 12 }}>⚠ {err}</div>}
      <div className="adm-field"><label className="adm-label">YouTube URL *</label><input className="adm-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
      <div className="adm-field"><label className="adm-label">Title</label><input className="adm-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Auto-detected if blank" /></div>
      <div className="adm-grid2">
        <div className="adm-field"><label className="adm-label">Category</label><input className="adm-input" value={category} onChange={e => setCat(e.target.value)} placeholder="e.g. Curry" /></div>
        <div className="adm-field"><label className="adm-label">Channel</label><input className="adm-input" value={channel} onChange={e => setCh(e.target.value)} placeholder="Channel name" /></div>
      </div>
      <div className="adm-field"><label className="adm-label">Keywords (comma separated)</label><input className="adm-input" value={keywords} onChange={e => setKw(e.target.value)} placeholder="dal, makhani, butter" /></div>
    </ModalWithFooter>
  );
}

function EditVideoModal({ video, onClose, onSaved }: { video: any; onClose: () => void; onSaved: () => void }) {
  const [recipeId, setRecipeId] = useState(video.recipe_id ?? '');
  const [title, setTitle] = useState(video.title ?? '');
  const [category, setCategory] = useState(video.category ?? '');
  const [keywords, setKeywords] = useState((video.keywords_json ?? (video.keywords ? [video.keywords] : []))?.join(', ') ?? '');
  const [channel, setChannel] = useState(video.channel ?? '');
  const [thumbnail, setThumbnail] = useState(video.thumbnail ?? '');
  const [status, setStatus] = useState(video.status ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const payload: any = {
        recipe_id: recipeId ? Number(recipeId) : null,
        title: title || null,
        category: category || null,
        keywords: keywords.split(',').map((s: string) => s.trim()).filter(Boolean),
        channel: channel || null,
        thumbnail: thumbnail || null,
        status: status || null,
      };
      await updateVideoApi(tok(), video.id, payload);
      onSaved();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWithFooter
      title={`Edit Video — #${video.id}`}
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn adm-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="adm-btn adm-btn-primary" onClick={save} disabled={saving}>{saving ? '⏳ Saving…' : 'Save changes'}</button>
        </>
      }
      wide
    >
      {err && <div style={{ color: 'var(--ar)', fontSize: 12, marginBottom: 12 }}>⚠ {err}</div>}
      <div className="adm-grid2">
        <div className="adm-field"><label className="adm-label">Recipe ID</label><input className="adm-input" value={recipeId} onChange={e => setRecipeId(e.target.value)} placeholder="Optional recipe id" /></div>
        <div className="adm-field"><label className="adm-label">Status</label>
          <select className="adm-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">(leave)</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
      </div>
      <div className="adm-field"><label className="adm-label">Title</label><input className="adm-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="adm-grid2">
        <div className="adm-field"><label className="adm-label">Category</label><input className="adm-input" value={category} onChange={e => setCategory(e.target.value)} /></div>
        <div className="adm-field"><label className="adm-label">Channel</label><input className="adm-input" value={channel} onChange={e => setChannel(e.target.value)} /></div>
      </div>
      <div className="adm-field"><label className="adm-label">Thumbnail URL</label><input className="adm-input" value={thumbnail} onChange={e => setThumbnail(e.target.value)} /></div>
      <div className="adm-field"><label className="adm-label">Keywords (comma separated)</label><input className="adm-input" value={keywords} onChange={e => setKeywords(e.target.value)} /></div>
    </ModalWithFooter>
  );
}
