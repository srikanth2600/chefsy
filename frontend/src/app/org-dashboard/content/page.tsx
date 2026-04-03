'use client';
import { useEffect, useState } from 'react';
import { useChefTheme } from '@/components/chef/ChefThemeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

interface Content {
  id: number;
  title: string;
  content_type: string;
  body: string | null;
  media_url: string | null;
  is_published: boolean;
  view_count: number;
  created_at: string;
}

const CONTENT_TYPES = ['article', 'video', 'tip', 'announcement'];
const TYPE_ICON: Record<string, string> = {
  article: '📄', video: '🎬', tip: '💡', announcement: '📣',
};

export default function ContentPage() {
  const { t, isDark } = useChefTheme();
  const [items,   setItems]   = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState('');

  const [showNew,    setShowNew]    = useState(false);
  const [newTitle,   setNewTitle]   = useState('');
  const [newType,    setNewType]    = useState('article');
  const [newBody,    setNewBody]    = useState('');
  const [newMedia,   setNewMedia]   = useState('');
  const [newPublish, setNewPublish] = useState(false);
  const [saving,     setSaving]     = useState(false);

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
    fetch(`${API}/org/me/content`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/org/me/content`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          content_type: newType,
          body: newBody.trim() || undefined,
          media_url: newMedia.trim() || undefined,
          is_published: newPublish,
        }),
      });
      if (r.ok) {
        showToast('Content created!');
        setShowNew(false); setNewTitle(''); setNewBody(''); setNewMedia(''); setNewPublish(false);
        load();
      } else {
        const d = await r.json().catch(() => ({}));
        showToast(d.detail || 'Failed to create.');
      }
    } catch { showToast('Network error.'); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this content item?')) return;
    const r = await fetch(`${API}/org/me/content/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` },
    }).catch(() => null);
    if (r?.ok) { showToast('Deleted.'); load(); }
    else showToast('Failed to delete.');
  };

  const togglePublish = async (item: Content) => {
    const r = await fetch(`${API}/org/me/content/${item.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !item.is_published }),
    }).catch(() => null);
    if (r?.ok) { showToast(item.is_published ? 'Unpublished.' : 'Published!'); load(); }
  };

  return (
    <div style={{ maxWidth: 900, fontFamily: 'inherit', color: t.textPrimary }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: t.textPrimary }}>Content</h1>
          <p style={{ fontSize: 13, color: t.textSecondary, margin: '4px 0 0' }}>Articles, videos and tips for your members</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          style={{ padding: '9px 20px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
          + New Content
        </button>
      </div>

      {/* New content form */}
      {showNew && (
        <div style={{ background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 14px', color: t.textPrimary }}>Create Content</p>
          <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Title *</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Post title" required />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select style={{ ...inp, width: '100%', boxSizing: 'border-box', cursor: 'pointer', colorScheme: isDark ? 'dark' : 'light' }} value={newType} onChange={e => setNewType(e.target.value)}>
                {CONTENT_TYPES.map(ct => <option key={ct} value={ct} style={{ background: t.bgInput, color: t.textPrimary }}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Body / Description</label>
              <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box', minHeight: 80, resize: 'vertical' } as React.CSSProperties}
                value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Content body or description…" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Media URL (video / image link)</label>
              <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={newMedia} onChange={e => setNewMedia(e.target.value)} placeholder="https://…" />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="pubCheck" checked={newPublish} onChange={e => setNewPublish(e.target.checked)}
                style={{ width: 15, height: 15, cursor: 'pointer', accentColor: t.accent }} />
              <label htmlFor="pubCheck" style={{ fontSize: 13, color: t.textSecondary, cursor: 'pointer' }}>Publish immediately</label>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving}
                style={{ padding: '8px 20px', background: t.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowNew(false)}
                style={{ ...inp, cursor: 'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ color: t.textSecondary, fontSize: 14, padding: '20px 0' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', color: t.textTertiary, fontSize: 14 }}>
          No content yet. Create your first article, video or tip above.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map(item => (
            <div key={item.id} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{TYPE_ICON[item.content_type] || '📄'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>{item.title}</span>
                    <span style={{
                      fontSize: 11, borderRadius: 99, padding: '1px 8px', fontWeight: 600,
                      background: item.is_published ? 'rgba(34,197,94,0.15)' : t.bgSurface,
                      color: item.is_published ? '#22c55e' : t.textTertiary,
                      border: `1px solid ${item.is_published ? 'rgba(34,197,94,0.3)' : t.border}`,
                    }}>
                      {item.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {item.body && <p style={{ fontSize: 12, color: t.textSecondary, margin: '0 0 4px', lineHeight: 1.5 }}>{item.body.slice(0, 140)}{item.body.length > 140 ? '…' : ''}</p>}
                  <div style={{ fontSize: 11, color: t.textTertiary }}>
                    {item.view_count} views · {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => togglePublish(item)}
                    style={{ fontSize: 12, color: item.is_published ? t.textSecondary : t.accent, background: 'none', border: `1px solid currentColor`, borderRadius: 6, cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit' }}>
                    {item.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => handleDelete(item.id)}
                    style={{ fontSize: 12, color: t.error || '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>
                    Delete
                  </button>
                </div>
              </div>
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
