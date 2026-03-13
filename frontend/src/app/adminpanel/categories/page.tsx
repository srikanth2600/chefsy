'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

interface Category {
  id: number; name: string; slug: string;
  parent_id: number | null; level: number; created_at: string;
  children?: Category[];
}

function getToken() { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } }
function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const LEVEL_COLORS = ['#DA7756', '#60A5FA', '#A78BFA'];
const LEVEL_LABELS = ['Category', 'Sub Category', 'Sub Sub Category'];

function CategoryRow({ cat, depth, onEdit, onDelete }: {
  cat: Category; depth: number;
  onEdit: (c: Category) => void; onDelete: (c: Category) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = (cat.children || []).length > 0;
  const color = LEVEL_COLORS[Math.min(depth, 2)];

  return (
    <>
      <tr>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: depth * 24 }}>
            {hasChildren ? (
              <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px 0 0', color: 'var(--at3)', fontSize: 9 }}>
                {open ? '▼' : '▶'}
              </button>
            ) : <span style={{ width: 18, display: 'inline-block' }} />}
            <span style={{ fontWeight: depth === 0 ? 700 : 500, color: 'var(--at)', fontSize: 13 }}>{cat.name}</span>
          </div>
        </td>
        <td style={{ fontSize: 12, color: 'var(--at3)', fontFamily: 'monospace' }}>{cat.slug}</td>
        <td>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: color + '22', color, fontWeight: 600 }}>
            {LEVEL_LABELS[Math.min(depth, 2)]}
          </span>
        </td>
        <td style={{ color: 'var(--at3)', fontSize: 12 }}>{hasChildren ? `${(cat.children||[]).length} sub` : '—'}</td>
        <td style={{ textAlign: 'right' }}>
          <div className="adm-row adm-g2" style={{ justifyContent: 'flex-end' }}>
            <button className="adm-btn adm-btn-sm" onClick={() => onEdit(cat)}>Edit</button>
            <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => onDelete(cat)}>Delete</button>
          </div>
        </td>
      </tr>
      {open && (cat.children || []).map(child => (
        <CategoryRow key={child.id} cat={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[]>([]);
  const [flat, setFlat] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const tok = getToken();
    Promise.all([
      fetch(`${API}/admin/categories/tree`, { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/admin/categories`, { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([t, f]) => {
      if (t) setTree(t.tree);
      if (f) setFlat(f.categories);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null); setName(''); setSlug(''); setParentId(''); setSlugManual(false); setError(''); setShowForm(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c); setName(c.name); setSlug(c.slug);
    setParentId(c.parent_id ? String(c.parent_id) : '');
    setSlugManual(true); setError(''); setShowForm(true);
  };
  const cancel = () => { setShowForm(false); setEditing(null); };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual) setSlug(slugify(v));
  };

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!slug.trim()) { setError('Slug is required'); return; }
    setSaving(true); setError('');
    const tok = getToken();
    const url = editing ? `${API}/admin/categories/${editing.id}` : `${API}/admin/categories`;
    const method = editing ? 'PUT' : 'POST';
    const body: Record<string, unknown> = { name: name.trim(), slug: slug.trim() };
    if (!editing) body.parent_id = parentId ? parseInt(parentId) : null;
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      setShowForm(false); load();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  };

  const del = async (cat: Category) => {
    const hasChildren = (cat.children || []).length > 0;
    const msg = hasChildren ? `Delete "${cat.name}" and all its sub-categories?` : `Delete category "${cat.name}"?`;
    if (!confirm(msg)) return;
    const tok = getToken();
    await fetch(`${API}/admin/categories/${cat.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } });
    load();
  };

  const parentOptions = flat.filter(c => (!editing || c.id !== editing.id) && c.level <= 2);
  const l1 = flat.filter(c => c.level === 1).length;
  const l2 = flat.filter(c => c.level === 2).length;
  const l3 = flat.filter(c => c.level === 3).length;

  return (
    <div>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Categories</div>
          <div className="adm-ph-sub">Flexible hierarchy: Category → Sub Category → Sub Sub Category · {flat.length} total</div>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={openAdd}>+ Add Category</button>
      </div>

      {/* Stats */}
      <div className="adm-stats adm-mb3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[
          { icon: '📁', val: l1, label: 'Categories', color: 'orange' },
          { icon: '📂', val: l2, label: 'Sub Categories', color: 'blue' },
          { icon: '📄', val: l3, label: 'Sub Sub Categories', color: 'purple' },
        ].map(s => (
          <div key={s.label} className={`adm-stat ${s.color}`}>
            <div className="adm-stat-icon">{s.icon}</div>
            <div className="adm-stat-val">{s.val}</div>
            <div className="adm-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="adm-card adm-mb3" style={{ border: '1px solid var(--ae2)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--at)', marginBottom: 14 }}>
            {editing ? `Edit: ${editing.name}` : 'New Category'}
          </div>
          <div className="adm-row adm-g3 adm-mb2">
            <div style={{ flex: 1 }}>
              <label className="adm-label">Name *</label>
              <input className="adm-input" value={name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Indian" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="adm-label">Slug *</label>
              <input
                className="adm-input"
                value={slug}
                onChange={e => { setSlugManual(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }}
                placeholder="e.g. indian"
              />
            </div>
            {!editing && (
              <div style={{ flex: 1 }}>
                <label className="adm-label">Parent Category</label>
                <select className="adm-select" value={parentId} onChange={e => setParentId(e.target.value)}>
                  <option value="">— Root (Level 1) —</option>
                  {parentOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {'  '.repeat(c.level - 1)}{c.level > 1 ? '↳ ' : ''}{c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {!editing && (
            <p style={{ fontSize: 11, color: 'var(--at3)', marginBottom: 10 }}>
              {parentId
                ? (() => {
                    const p = flat.find(c => c.id === parseInt(parentId));
                    const lvl = (p?.level ?? 0) + 1;
                    return `Will be created as: ${LEVEL_LABELS[lvl - 1] || 'Sub Sub Category'} (Level ${lvl})`;
                  })()
                : 'Will be created as: Category (Level 1)'}
            </p>
          )}
          {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</p>}
          <div className="adm-row adm-g2">
            <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tree Table */}
      {loading ? (
        <div className="adm-card">
          {[1,2,3,4].map(i => <div key={i} className="adm-sk" style={{ height: 38, marginBottom: 8, borderRadius: 8 }} />)}
        </div>
      ) : tree.length === 0 ? (
        <div className="adm-card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="adm-empty-icon">📂</div>
          <div className="adm-empty-title">No categories yet</div>
          <div style={{ color: 'var(--at3)', fontSize: 13, marginTop: 4 }}>Create your first category to organise recipes.</div>
        </div>
      ) : (
        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="adm-tbl-wrap">
            <table className="adm-tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Level</th>
                  <th>Children</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tree.map(cat => (
                  <CategoryRow key={cat.id} cat={cat} depth={0} onEdit={openEdit} onDelete={del} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="adm-row adm-g3" style={{ marginTop: 16 }}>
        {LEVEL_COLORS.map((color, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--at3)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            {LEVEL_LABELS[i]}
          </div>
        ))}
      </div>
    </div>
  );
}
