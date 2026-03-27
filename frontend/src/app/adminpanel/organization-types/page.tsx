'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

interface OrgType {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function getToken() {
  try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; }
}

const EMPTY: Omit<OrgType, 'id' | 'created_at' | 'updated_at'> = {
  name: '', description: '', icon: '', is_active: true, sort_order: 0,
};

export default function OrgTypesPage() {
  const [types,   setTypes]   = useState<OrgType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<OrgType | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [deleteErr, setDeleteErr] = useState('');

  const load = () => {
    const tok = getToken();
    fetch(`${API}/admin/organization-types`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setTypes(d.types ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null); setForm({ ...EMPTY }); setError(''); setShowForm(true);
  };
  const openEdit = (t: OrgType) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description ?? '', icon: t.icon ?? '', is_active: t.is_active, sort_order: t.sort_order });
    setError(''); setShowForm(true);
  };
  const cancel = () => { setShowForm(false); setEditing(null); };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    const tok = getToken();
    const url    = editing ? `${API}/admin/organization-types/${editing.id}` : `${API}/admin/organization-types`;
    const method = editing ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          name:        form.name.trim(),
          description: form.description?.trim() || null,
          icon:        form.icon?.trim() || null,
          is_active:   form.is_active,
          sort_order:  Number(form.sort_order) || 0,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      setShowForm(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteErr('');
    const tok = getToken();
    try {
      const r = await fetch(`${API}/admin/organization-types/${deleteId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${tok}` },
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      setDeleteId(null); load();
    } catch (e: any) { setDeleteErr(e.message); }
  };

  return (
    <div>
      {/* Page header */}
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Organization Types</div>
          <div className="adm-ph-sub">
            Manage the organization categories available during registration · {types.length} total
          </div>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={openAdd}>+ Add Type</button>
      </div>

      {/* Add / Edit inline form */}
      {showForm && (
        <div className="adm-card adm-mb3" style={{ border: '1px solid var(--ae2)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--at)', marginBottom: 16 }}>
            {editing ? 'Edit Organization Type' : 'New Organization Type'}
          </div>

          {/* Row 1: name + icon */}
          <div className="adm-row adm-g3 adm-mb2" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="adm-label">Name *</label>
              <input
                className="adm-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Restaurant"
              />
            </div>
            <div style={{ flex: '0 0 100px' }}>
              <label className="adm-label">Icon / Emoji</label>
              <input
                className="adm-input"
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="🍽️"
                style={{ textAlign: 'center', fontSize: 18 }}
              />
            </div>
            <div style={{ flex: '0 0 100px' }}>
              <label className="adm-label">Sort Order</label>
              <input
                className="adm-input"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Row 2: description + active */}
          <div className="adm-row adm-g3 adm-mb2" style={{ flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px' }}>
              <label className="adm-label">Description</label>
              <input
                className="adm-input"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short description (shown in registration form)"
              />
            </div>
            <div style={{ flex: '0 0 140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label className="adm-label">Status</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 2 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--ap)' }}
                />
                <span style={{ fontSize: 13, color: 'var(--at2)' }}>Active</span>
              </label>
            </div>
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10, marginTop: -4 }}>{error}</p>
          )}

          <div className="adm-row adm-g2">
            <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <div className="adm-overlay">
          <div className="adm-confirm">
            <div className="adm-confirm-icon">⚠️</div>
            <div className="adm-confirm-title">Delete Organization Type</div>
            <div className="adm-confirm-msg">
              This cannot be undone. If any users are registered under this type, deletion will be blocked — use &quot;Deactivate&quot; instead.
            </div>
            {deleteErr && (
              <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8, marginTop: -4, textAlign: 'center' }}>{deleteErr}</p>
            )}
            <div className="adm-confirm-btns">
              <button className="adm-btn adm-btn-ghost" onClick={() => { setDeleteId(null); setDeleteErr(''); }}>Cancel</button>
              <button className="adm-btn adm-btn-danger" onClick={confirmDelete}>Yes, delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="adm-card">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="adm-sk" style={{ height: 44, marginBottom: 8, borderRadius: 8 }} />
          ))}
        </div>
      ) : types.length === 0 ? (
        <div className="adm-card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="adm-empty-icon">🏢</div>
          <div className="adm-empty-title">No organization types yet</div>
          <div style={{ color: 'var(--at3)', fontSize: 13, marginTop: 6 }}>
            Create types like Chef, Restaurant, GYM, Hospital to show in the registration form.
          </div>
          <button className="adm-btn adm-btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>
            + Add First Type
          </button>
        </div>
      ) : (
        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="adm-tbl-wrap">
            <table className="adm-tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Order</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Status</th>
                  <th style={{ width: 60, textAlign: 'center' }}>Users</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t, i) => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--at3)', fontSize: 11 }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {t.icon && (
                          <span style={{
                            fontSize: 20, width: 32, height: 32, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            background: 'var(--ae)', borderRadius: 8, flexShrink: 0,
                          }}>
                            {t.icon}
                          </span>
                        )}
                        <span className="td-bold">{t.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--at3)', fontSize: 12, maxWidth: 240 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {t.description || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--at3)', fontSize: 12 }}>{t.sort_order}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: t.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.15)',
                        color: t.is_active ? '#16a34a' : 'var(--at3)',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--at3)', fontSize: 12 }}>—</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="adm-row adm-g2" style={{ justifyContent: 'flex-end' }}>
                        <button className="adm-btn adm-btn-sm" onClick={() => openEdit(t)}>Edit</button>
                        <button
                          className="adm-btn adm-btn-sm"
                          style={{ color: t.is_active ? '#d97706' : '#16a34a' }}
                          onClick={async () => {
                            const tok = getToken();
                            await fetch(`${API}/admin/organization-types/${t.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
                              body: JSON.stringify({ is_active: !t.is_active }),
                            });
                            load();
                          }}
                        >
                          {t.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="adm-btn adm-btn-danger adm-btn-sm"
                          onClick={() => { setDeleteId(t.id); setDeleteErr(''); }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="adm-card adm-mt3" style={{ background: 'var(--ae)', border: 'none' }}>
        <p style={{ fontSize: 12, color: 'var(--at3)', margin: 0, lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--at2)' }}>How it works:</strong> Active types appear as pill chips in the
          registration form when a user selects &quot;Organization&quot;. Types named{' '}
          <em>Chef</em> or <em>Restaurant</em> also trigger a profile-handle field for creating a public chef profile.
          Deactivate rather than delete types that are already in use.
        </p>
      </div>
    </div>
  );
}
