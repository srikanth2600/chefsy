'use client';
/**
 * Ads & Banners  /adminpanel/ads
 * APIs needed:
 *   GET    /admin/ads?page=&per_page=           → { ads:[{id,title,body,cta_url,cta_text,is_active,impressions,clicks,created_at}], total }
 *   POST   /admin/ads        body: { title, body, cta_url, cta_text, placement }
 *   PATCH  /admin/ads/:id    body: { is_active }
 *   DELETE /admin/ads/:id
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ModalWithFooter, ConfirmDialog, Pagination } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = (json = false) => ({ Authorization: `Bearer ${tok()}`, ...(json ? { 'Content-Type': 'application/json' } : {}) });

type Ad = {
  id: number; title?: string; body?: string; cta_url?: string; cta_text?: string;
  placement?: string; is_active?: boolean; impressions?: number; clicks?: number; created_at?: string;
};

const BLANK: Partial<Ad> = { title: '', body: '', cta_url: '', cta_text: '', placement: 'chat' };

export default function AdsPage() {
  const router = useRouter();
  const [ads,     setAds]     = useState<Ad[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Ad> | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; fn: () => void } | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const perPage = 15;

  const load = useCallback(async (pg = page) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/admin/ads?page=${pg}&per_page=${perPage}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setAds(Array.isArray(j.ads) ? j.ads : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page]); // eslint-disable-line

  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  const doSave = async () => {
    if (!editing) return;
    setSaving(true); setSaveErr('');
    try {
      const isNew = !editing.id;
      const r = await fetch(`${API}/admin/ads${isNew ? '' : `/${editing.id}`}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: hdr(true),
        body: JSON.stringify(editing),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      setEditing(null); load(page);
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const doToggle = async (ad: Ad) => {
    await fetch(`${API}/admin/ads/${ad.id}`, { method: 'PATCH', headers: hdr(true), body: JSON.stringify({ is_active: !ad.is_active }) });
    load(page);
  };

  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/ads/${id}`, { method: 'DELETE', headers: hdr() });
    load(page);
  };

  const ctr = (ad: Ad) => ad.impressions ? `${((ad.clicks ?? 0) / ad.impressions * 100).toFixed(1)}%` : '—';

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Ads & Banners</div>
          <div className="adm-ph-sub">Manage sponsored content in the chat feed</div>
        </div>
        <div className="adm-ph-actions">
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => { setSaveErr(''); setEditing({ ...BLANK }); }}>
            + New Ad
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Title</th>
                <th>Placement</th>
                <th>CTA</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(6).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="adm-sk" style={{ height: 13, width: j === 0 ? 160 : 70 }} /></td>)}</tr>
              )) : ads.length === 0 ? (
                <tr><td colSpan={8}><div className="adm-empty"><div className="adm-empty-icon">◈</div><div className="adm-empty-title">No ads yet</div><div>Create your first ad to show in the chat feed</div></div></td></tr>
              ) : ads.map(ad => (
                <tr key={ad.id}>
                  <td>
                    <div className="td-bold adm-truncate" style={{ maxWidth: 180 }}>{ad.title || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--at3)', marginTop: 2 }} className="adm-truncate">{ad.body}</div>
                  </td>
                  <td>{ad.placement ? <span className="adm-tag">{ad.placement}</span> : '—'}</td>
                  <td>
                    {ad.cta_url ? <a href={ad.cta_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--acc)', textDecoration: 'none' }}>
                      {ad.cta_text || '↗ Link'}
                    </a> : '—'}
                  </td>
                  <td className="adm-mono">{(ad.impressions ?? 0).toLocaleString()}</td>
                  <td className="adm-mono">{(ad.clicks ?? 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: 'var(--acc)' }}>{ctr(ad)}</td>
                  <td><span className={`adm-badge ${ad.is_active ? 'green' : 'gray'}`}>{ad.is_active ? 'Active' : 'Paused'}</span></td>
                  <td>
                    <div className="adm-row adm-g2">
                      <button className="adm-btn adm-btn-info adm-btn-sm" onClick={() => { setSaveErr(''); setEditing({ ...ad }); }}>Edit</button>
                      <button className={`adm-btn adm-btn-sm ${ad.is_active ? 'adm-btn-warn' : 'adm-btn-success'}`} onClick={() => doToggle(ad)}>
                        {ad.is_active ? 'Pause' : 'Activate'}
                      </button>
                      <button className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() => setConfirm({ msg: `Delete ad "${ad.title}"?`, fn: () => { setConfirm(null); doDelete(ad.id!); } })}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} perPage={perPage} onPage={setPage} />
      </div>

      {/* Create / edit modal */}
      {editing && (
        <ModalWithFooter
          title={editing.id ? `Edit Ad #${editing.id}` : 'New Ad'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="adm-btn adm-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="adm-btn adm-btn-primary" onClick={doSave} disabled={saving}>{saving ? '⏳ Saving…' : editing.id ? 'Save Changes' : 'Create Ad'}</button>
            </>
          }
        >
          {saveErr && <div style={{ color: 'var(--ar)', fontSize: 12, marginBottom: 12 }}>⚠ {saveErr}</div>}
          <div className="adm-field">
            <label className="adm-label">Title</label>
            <input className="adm-input" value={editing.title ?? ''} onChange={e => setEditing(p => ({ ...p!, title: e.target.value }))} placeholder="Ad headline" />
          </div>
          <div className="adm-field">
            <label className="adm-label">Body Text</label>
            <textarea className="adm-textarea" rows={2} value={editing.body ?? ''} onChange={e => setEditing(p => ({ ...p!, body: e.target.value }))} placeholder="Short description shown in chat" />
          </div>
          <div className="adm-grid2">
            <div className="adm-field">
              <label className="adm-label">CTA URL</label>
              <input className="adm-input" value={editing.cta_url ?? ''} onChange={e => setEditing(p => ({ ...p!, cta_url: e.target.value }))} placeholder="https://…" />
            </div>
            <div className="adm-field">
              <label className="adm-label">CTA Button Text</label>
              <input className="adm-input" value={editing.cta_text ?? ''} onChange={e => setEditing(p => ({ ...p!, cta_text: e.target.value }))} placeholder="Learn More" />
            </div>
          </div>
          <div className="adm-field">
            <label className="adm-label">Placement</label>
            <select className="adm-select" value={editing.placement ?? 'chat'} onChange={e => setEditing(p => ({ ...p!, placement: e.target.value }))}>
              <option value="chat">Chat Feed</option>
              <option value="recipe">After Recipe</option>
              <option value="sidebar">Sidebar</option>
            </select>
          </div>
        </ModalWithFooter>
      )}

      {confirm && <ConfirmDialog title="Delete Ad" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}
