'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

interface Role { id: number; name: string; description: string | null; created_at: string; }

function getToken() { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } }

export default function ChefRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const tok = getToken();
    fetch(`${API}/admin/chef-roles`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRoles(d.roles); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setName(''); setDescription(''); setError(''); setShowForm(true); };
  const openEdit = (r: Role) => { setEditing(r); setName(r.name); setDescription(r.description || ''); setError(''); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditing(null); };

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    const tok = getToken();
    const url = editing ? `${API}/admin/chef-roles/${editing.id}` : `${API}/admin/chef-roles`;
    const method = editing ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      setShowForm(false);
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? This will remove it from all chefs.`)) return;
    const tok = getToken();
    await fetch(`${API}/admin/chef-roles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } });
    load();
  };

  return (
    <div>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Chef Roles</div>
          <div className="adm-ph-sub">Manage roles assignable to chefs · {roles.length} total</div>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={openAdd}>+ Add Role</button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="adm-card adm-mb3" style={{ border: '1px solid var(--ae2)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--at)', marginBottom: 14 }}>
            {editing ? 'Edit Role' : 'New Role'}
          </div>
          <div className="adm-row adm-g3 adm-mb2">
            <div style={{ flex: 1 }}>
              <label className="adm-label">Role Name *</label>
              <input className="adm-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Executive Chef" />
            </div>
            <div style={{ flex: 2 }}>
              <label className="adm-label">Description</label>
              <input className="adm-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description (optional)" />
            </div>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</p>}
          <div className="adm-row adm-g2">
            <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Roles Table */}
      {loading ? (
        <div className="adm-card">
          {[1,2,3].map(i => <div key={i} className="adm-sk" style={{ height: 40, marginBottom: 8, borderRadius: 8 }} />)}
        </div>
      ) : roles.length === 0 ? (
        <div className="adm-card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="adm-empty-icon">🏷</div>
          <div className="adm-empty-title">No roles yet</div>
          <div style={{ color: 'var(--at3)', fontSize: 13, marginTop: 4 }}>Create your first chef role to get started.</div>
        </div>
      ) : (
        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="adm-tbl-wrap">
            <table className="adm-tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Role Name</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role, i) => (
                  <tr key={role.id}>
                    <td style={{ color: 'var(--at3)', fontSize: 11 }}>{i + 1}</td>
                    <td className="td-bold">{role.name}</td>
                    <td style={{ color: 'var(--at3)', fontSize: 12 }}>{role.description || '—'}</td>
                    <td style={{ color: 'var(--at3)', fontSize: 12 }}>{role.created_at.slice(0, 10)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="adm-row adm-g2" style={{ justifyContent: 'flex-end' }}>
                        <button className="adm-btn adm-btn-sm" onClick={() => openEdit(role)}>Edit</button>
                        <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => del(role.id, role.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
