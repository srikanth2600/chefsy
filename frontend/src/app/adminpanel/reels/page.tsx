'use client';
/**
 * Admin Reels  /adminpanel/reels
 * APIs:
 *   GET    /admin/reels?q=&status=&chef_id=&page=&per_page=   → { reels:[...], total }
 *   PUT    /admin/reels/:id   body: { status, title, ... }    → update
 *   DELETE /admin/reels/:id                                    → delete
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ModalWithFooter, ConfirmDialog, Pagination } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = (json = false) => ({ Authorization: `Bearer ${tok()}`, ...(json ? { 'Content-Type': 'application/json' } : {}) });

function getYouTubeId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    return u.searchParams.get('v') || '';
  } catch { return ''; }
}

type Reel = {
  id: number;
  chef_id: number;
  chef_name?: string;
  chef_slug?: string;
  title: string;
  description?: string;
  hashtags?: string[];
  video_url?: string;
  video_file_path?: string;
  platform?: string;
  thumbnail?: string;
  status: string;
  view_count: number;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = { active: 'green', inactive: 'gray', pending: 'yellow' };

export default function AdminReelsPage() {
  const router = useRouter();
  const [reels,    setReels]    = useState<Reel[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [q,        setQ]        = useState('');
  const [status,   setStatus]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<Reel | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const [editing,  setEditing]  = useState<Reel | null>(null);
  const [playing,  setPlaying]  = useState<number | null>(null);
  const perPage = 15;

  const load = useCallback(async (pg = page) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (q)      p.set('q',      q);
      if (status) p.set('status', status);
      const r = await fetch(`${API}/admin/reels?${p}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setReels(Array.isArray(j.reels) ? j.reels : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, q, status]); // eslint-disable-line

  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/reels/${id}`, { method: 'DELETE', headers: hdr() });
    setSelected(null);
    load(page);
  };

  const doToggleStatus = async (reel: Reel) => {
    const newStatus = reel.status === 'active' ? 'inactive' : 'active';
    await fetch(`${API}/admin/reels/${reel.id}`, {
      method: 'PUT',
      headers: hdr(true),
      body: JSON.stringify({ status: newStatus }),
    });
    load(page);
  };

  /* preview thumbnail */
  function Thumb({ reel }: { reel: Reel }) {
    const ytId = reel.platform === 'youtube' && reel.video_url ? getYouTubeId(reel.video_url) : '';
    if (ytId) return <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 5 }} />;
    if (reel.thumbnail) return <img src={reel.thumbnail} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 5 }} />;
    return <div style={{ width: 64, height: 36, borderRadius: 5, background: 'var(--ab3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎬</div>;
  }

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Chef Reels</div>
          <div className="adm-ph-sub">Manage cooking video reels · {total} total</div>
        </div>
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      <div className="adm-filters">
        <input
          className="adm-input"
          placeholder="Search title, description…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1))}
        />
        <select className="adm-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => { setPage(1); load(1); }}>Search</button>
        {(q || status) && (
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setQ(''); setStatus(''); setPage(1); load(1); }}>Clear</button>
        )}
      </div>

      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Thumb</th>
                <th>Title</th>
                <th>Chef</th>
                <th>Platform</th>
                <th>Views</th>
                <th>Hashtags</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(9).fill(0).map((_, j) => <td key={j}><div className="adm-sk" style={{ height: 13, width: j === 0 ? 64 : 90 }} /></td>)}</tr>
              )) : reels.length === 0 ? (
                <tr><td colSpan={9}><div className="adm-empty"><div className="adm-empty-icon">🎬</div><div className="adm-empty-title">No reels found</div></div></td></tr>
              ) : reels.map(reel => (
                <tr key={reel.id}>
                  <td><Thumb reel={reel} /></td>
                  <td>
                    <div className="td-bold adm-truncate" style={{ maxWidth: 180 }}>{reel.title}</div>
                    {reel.description && (
                      <div style={{ fontSize: 11, color: 'var(--at3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {reel.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{reel.chef_name || '—'}</div>
                    {reel.chef_slug && (
                      <a href={`/chef/${reel.chef_slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--acc)' }}>
                        @{reel.chef_slug}
                      </a>
                    )}
                  </td>
                  <td>
                    {reel.platform ? (
                      <span className="adm-tag">{reel.platform}</span>
                    ) : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--fm)', fontSize: 13 }}>{reel.view_count ?? 0}</td>
                  <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--acc)' }}>
                    {(reel.hashtags || []).join(' ') || '—'}
                  </td>
                  <td>
                    <span className={`adm-badge ${STATUS_COLORS[reel.status] || 'gray'}`}>{reel.status}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{reel.created_at ? new Date(reel.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="adm-row adm-g2">
                      <button className="adm-btn adm-btn-info adm-btn-sm" onClick={() => { setSelected(reel); setPlaying(null); }}>View</button>
                      <button
                        className={`adm-btn adm-btn-sm ${reel.status === 'active' ? 'adm-btn-warn' : 'adm-btn-success'}`}
                        onClick={() => doToggleStatus(reel)}
                      >
                        {reel.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() => setConfirm({ msg: `Delete reel "${reel.title}"?`, fn: () => { setConfirm(null); doDelete(reel.id); } })}
                      >Del</button>
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
          title={selected.title}
          onClose={() => { setSelected(null); setPlaying(null); }}
          wide
          footer={
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setEditing(selected)}>Edit</button>
                {(selected.platform === 'youtube' || selected.platform === 'vimeo' || selected.platform === 'upload' || selected.platform === 'direct') && (
                  <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setPlaying(playing === selected.id ? null : selected.id)}>
                    {playing === selected.id ? 'Close Player' : 'Watch'}
                  </button>
                )}
                {selected.video_url && (
                  <a href={selected.video_url} target="_blank" rel="noreferrer" className="adm-btn adm-btn-ghost adm-btn-sm" style={{ textDecoration: 'none' }}>↗ Open</a>
                )}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button
                  className={`adm-btn adm-btn-sm ${selected.status === 'active' ? 'adm-btn-warn' : 'adm-btn-success'}`}
                  onClick={() => { doToggleStatus(selected); setSelected(null); }}
                >
                  {selected.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  className="adm-btn adm-btn-danger adm-btn-sm"
                  onClick={() => setConfirm({ msg: 'Delete this reel?', fn: () => { setConfirm(null); doDelete(selected.id); } })}
                >Delete</button>
              </div>
            </>
          }
        >
          {/* Video player */}
          {playing === selected.id && (
            <div style={{ marginBottom: 16 }}>
              {selected.platform === 'youtube' && selected.video_url && (() => {
                const ytId = getYouTubeId(selected.video_url);
                return ytId ? (
                  <iframe width="100%" height="315" src={`https://www.youtube.com/embed/${ytId}?rel=0&autoplay=1`}
                    title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ borderRadius: 8 }} />
                ) : null;
              })()}
              {selected.platform === 'vimeo' && selected.video_url && (
                <iframe width="100%" height="315" src={`https://player.vimeo.com/video/${selected.video_url.split('/').pop()}?autoplay=1`}
                  title="Vimeo" frameBorder="0" allow="autoplay; fullscreen" allowFullScreen style={{ borderRadius: 8 }} />
              )}
              {(selected.platform === 'upload' || selected.platform === 'direct') && (
                <video controls style={{ width: '100%', borderRadius: 8 }}
                  src={selected.video_file_path ? `${API}${selected.video_file_path}` : selected.video_url} />
              )}
            </div>
          )}

          {/* Thumbnail */}
          {playing !== selected.id && (() => {
            const ytId = selected.platform === 'youtube' && selected.video_url ? getYouTubeId(selected.video_url) : '';
            return ytId ? (
              <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 14, maxHeight: 200, objectFit: 'cover' }} />
            ) : null;
          })()}

          {/* Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {[
              { label: 'Chef', value: selected.chef_name },
              { label: 'Platform', value: selected.platform ? <span className="adm-tag">{selected.platform}</span> : '—' },
              { label: 'Status', value: <span className={`adm-badge ${STATUS_COLORS[selected.status] || 'gray'}`}>{selected.status}</span> },
              { label: 'Views', value: selected.view_count },
              { label: 'Created', value: selected.created_at ? new Date(selected.created_at).toLocaleString() : '—' },
              { label: 'Chef Slug', value: selected.chef_slug ? <a href={`/chef/${selected.chef_slug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--acc)' }}>@{selected.chef_slug}</a> : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--ae)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--at3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--at)' }}>{value ?? '—'}</div>
              </div>
            ))}
          </div>
          {selected.description && (
            <div style={{ marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--ae)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--at3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Description</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--at)', lineHeight: 1.5 }}>{selected.description}</p>
            </div>
          )}
          {selected.hashtags && selected.hashtags.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--ae)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--at3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Hashtags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selected.hashtags.map(h => (
                  <span key={h} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 99, background: 'var(--acb)', color: 'var(--acc)', border: '1px solid var(--acb2)' }}>
                    {h.startsWith('#') ? h : `#${h}`}
                  </span>
                ))}
              </div>
            </div>
          )}
          {selected.video_url && (
            <div style={{ marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--ae)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--at3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Video URL</div>
              <a href={selected.video_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--acc)', wordBreak: 'break-all' }}>{selected.video_url}</a>
            </div>
          )}
        </ModalWithFooter>
      )}

      {/* Edit modal */}
      {editing && (
        <EditReelModal
          reel={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setSelected(null); load(1); }}
        />
      )}

      {confirm && <ConfirmDialog title="Confirm" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}

function EditReelModal({ reel, onClose, onSaved }: { reel: Reel; onClose: () => void; onSaved: () => void }) {
  const [title,       setTitle]       = useState(reel.title ?? '');
  const [description, setDescription] = useState(reel.description ?? '');
  const [status,      setStatus]      = useState(reel.status ?? 'active');
  const [hashInput,   setHashInput]   = useState((reel.hashtags || []).join(', '));
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState('');

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const tags = hashInput.split(',').map(s => s.trim().replace(/^#+/, '')).filter(Boolean).map(s => `#${s}`);
      const r = await fetch(`${API}/admin/reels/${reel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gharka_token') || ''}` },
        body: JSON.stringify({ title: title || null, description: description || null, hashtags: tags, status }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      onSaved();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWithFooter
      title={`Edit Reel — #${reel.id}`}
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
      <div className="adm-field"><label className="adm-label">Title</label><input className="adm-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="adm-field">
        <label className="adm-label">Status</label>
        <select className="adm-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </div>
      <div className="adm-field"><label className="adm-label">Description</label><textarea className="adm-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical' }} /></div>
      <div className="adm-field"><label className="adm-label">Hashtags (comma separated)</label><input className="adm-input" value={hashInput} onChange={e => setHashInput(e.target.value)} placeholder="paneer, indianfood, quickrecipe" /></div>
    </ModalWithFooter>
  );
}
