'use client';
/**
 * Admin /adminpanel/meal-plan-options
 * Manage dietary preference, allergy and cuisine options shown in the
 * Meal Planner generate modal.
 *
 * APIs:
 *   GET    /admin/meal-plan-options
 *   POST   /admin/meal-plan-options
 *   PUT    /admin/meal-plan-options/:id
 *   DELETE /admin/meal-plan-options/:id
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' });

type Category = 'dietary' | 'allergy' | 'cuisine';

const CATEGORIES: { key: Category; label: string; icon: string; color: string }[] = [
  { key: 'dietary',  label: 'Dietary Preferences', icon: '🥦', color: '#4ade80' },
  { key: 'allergy',  label: 'Allergies / Avoid',    icon: '⚠️',  color: '#f87171' },
  { key: 'cuisine',  label: 'Cuisine Types',        icon: '🌍', color: '#60a5fa' },
];

type Option = {
  id: number;
  category: Category;
  label: string;
  sort_order: number;
  is_active: boolean;
};

type FormState = { label: string; sort_order: number; is_active: boolean };

const EMPTY_FORM: FormState = { label: '', sort_order: 0, is_active: true };

export default function MealPlanOptionsPage() {
  const router = useRouter();
  const [options, setOptions]   = useState<Option[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Category>('dietary');

  // Edit / add form state
  const [editing, setEditing]   = useState<Option | null>(null); // null = new
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [confirm, setConfirm]   = useState<{ msg: string; fn: () => void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/admin/meal-plan-options`, { headers: hdr() as HeadersInit });
      if (res.status === 403) { router.push('/adminpanel/login'); return; }
      if (!res.ok) throw new Error('Failed to load');
      setOptions(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = (cat: Category) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: options.filter(o => o.category === cat).length });
    setShowForm(true);
  };

  const openEdit = (opt: Option) => {
    setEditing(opt);
    setForm({ label: opt.label, sort_order: opt.sort_order, is_active: opt.is_active });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) return;
    setSaving(true); setError(null);
    try {
      const body = JSON.stringify({ category: activeTab, ...form, label: form.label.trim() });
      const url  = editing ? `${API}/admin/meal-plan-options/${editing.id}` : `${API}/admin/meal-plan-options`;
      const res  = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: hdr() as HeadersInit, body });
      if (!res.ok) throw new Error('Failed to save');
      const saved: Option = await res.json();
      if (editing) {
        setOptions(prev => prev.map(o => o.id === saved.id ? saved : o));
      } else {
        setOptions(prev => [...prev, saved]);
      }
      setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/meal-plan-options/${id}`, { method: 'DELETE', headers: hdr() as HeadersInit });
    setOptions(prev => prev.filter(o => o.id !== id));
    setConfirm(null);
  };

  const toggleActive = async (opt: Option) => {
    const res = await fetch(`${API}/admin/meal-plan-options/${opt.id}`, {
      method: 'PUT',
      headers: hdr() as HeadersInit,
      body: JSON.stringify({ category: opt.category, label: opt.label, sort_order: opt.sort_order, is_active: !opt.is_active }),
    });
    if (res.ok) {
      const saved: Option = await res.json();
      setOptions(prev => prev.map(o => o.id === saved.id ? saved : o));
    }
  };

  const catOptions = options.filter(o => o.category === activeTab).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  const catMeta    = CATEGORIES.find(c => c.key === activeTab)!;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          🥗 Meal Plan Options
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Manage the dropdown choices shown in the Meal Planner generate modal.
        </p>
      </div>

      {error && (
        <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--error)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', paddingBottom: 0 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => { setActiveTab(cat.key); setShowForm(false); }}
            style={{
              padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', borderRadius: '8px 8px 0 0',
              background: activeTab === cat.key ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === cat.key ? cat.color : 'var(--text-secondary)',
              borderBottom: activeTab === cat.key ? `2px solid ${cat.color}` : '2px solid transparent',
            }}
          >
            {cat.icon} {cat.label}
            <span style={{ marginLeft: 8, fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px' }}>
              {options.filter(o => o.category === cat.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Options list + add form side by side */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Options list */}
        <div style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border, rgba(255,255,255,0.08))', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: catMeta.color }}>{catMeta.icon} {catMeta.label}</span>
            <button
              onClick={() => openAdd(activeTab)}
              style={{ background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', border: '1px solid rgba(218,119,86,0.3)', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Option
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading…</div>
          ) : catOptions.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>No options yet — add the first one →</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                  {['Label', 'Order', 'Active', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {catOptions.map((opt, i) => (
                  <tr key={opt.id} style={{ borderBottom: i < catOptions.length - 1 ? '1px solid var(--border, rgba(255,255,255,0.05))' : 'none' }}>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {opt.label}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{opt.sort_order}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <button
                        onClick={() => toggleActive(opt)}
                        style={{
                          fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '2px 10px', border: 'none', cursor: 'pointer',
                          background: opt.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                          color: opt.is_active ? '#4ade80' : 'var(--text-secondary)',
                        }}
                      >
                        {opt.is_active ? 'Active' : 'Hidden'}
                      </button>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openEdit(opt)}
                          style={{ background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', border: '1px solid rgba(218,119,86,0.3)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirm({ msg: `Delete "${opt.label}"?`, fn: () => doDelete(opt.id) })}
                          style={{ background: 'rgba(224,107,107,0.12)', color: 'var(--error, #E06B6B)', border: '1px solid rgba(224,107,107,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div style={{ width: 280, flexShrink: 0, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border, rgba(255,255,255,0.08))', padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              {editing ? 'Edit Option' : `Add ${catMeta.label}`}
            </div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>
              Label
              <input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder={activeTab === 'cuisine' ? 'e.g. Japanese' : activeTab === 'dietary' ? 'e.g. Keto' : 'e.g. Shellfish'}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 7, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>
              Sort order
              <input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 7, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                style={{ width: 14, height: 14, cursor: 'pointer' }}
              />
              Active (shown in app)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 7, padding: '8px 0', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.label.trim() || saving}
                style={{ flex: 2, background: form.label.trim() ? 'var(--claude-orange)' : 'rgba(218,119,86,0.3)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: form.label.trim() ? 'pointer' : 'not-allowed' }}
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Option'}
              </button>
            </div>
          </div>
        )}
      </div>

      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </div>
  );
}