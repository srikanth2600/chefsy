'use client';
/**
 * Admin /adminpanel/packages
 * Manage subscription packages and per-feature access limits.
 *
 * Each feature has ONE limit row (not separate daily + monthly columns).
 * Admin picks: Blocked | Unlimited | Daily N | Monthly N
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' });

// ── Types ──────────────────────────────────────────────────────────────────

type FeatureLimit = {
  id?: number;
  feature: 'ai_recipe' | 'meal_plan' | 'ai_video';
  period: 'daily' | 'monthly';
  limit_value: number | null;
};

type Package = {
  id: number;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  is_active: boolean;
  sort_order: number;
  limits: FeatureLimit[];
};

type PackageForm = {
  name: string;
  display_name: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  is_active: boolean;
  sort_order: number;
};

// Per-feature limit as shown in the editor
type LimitEntry = {
  type: 'blocked' | 'unlimited' | 'daily' | 'monthly';
  value: string; // numeric string; ignored for blocked/unlimited
};

type LimitsFormType = Record<string, LimitEntry>;

const EMPTY_FORM: PackageForm = {
  name: '', display_name: '', description: '',
  price_monthly: '0', price_yearly: '0',
  is_active: true, sort_order: 0,
};

const FEATURES: { key: 'ai_recipe' | 'meal_plan' | 'ai_video'; label: string; icon: string; color: string; desc: string }[] = [
  { key: 'ai_recipe',  label: 'AI Recipes',    icon: '🍳', color: '#f97316', desc: 'AI-generated recipe creation' },
  { key: 'meal_plan',  label: 'Meal Planning',  icon: '🥗', color: '#4ade80', desc: 'Weekly meal plan generation' },
  { key: 'ai_video',   label: 'AI Videos',      icon: '🎬', color: '#a78bfa', desc: 'AI cooking video generation' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Derive the active LimitEntry from a package's limits array for one feature. */
function parseLimitEntry(limits: FeatureLimit[], feature: string): LimitEntry {
  const monthly = limits.find(l => l.feature === feature && l.period === 'monthly');
  const daily   = limits.find(l => l.feature === feature && l.period === 'daily');

  // Blocked: any period has value 0 and no positive limit elsewhere
  const allZero =
    (!monthly || monthly.limit_value === 0) &&
    (!daily   || daily.limit_value   === 0);
  if ((monthly?.limit_value === 0 || daily?.limit_value === 0) && allZero) {
    return { type: 'blocked', value: '0' };
  }

  // Daily active limit
  if (daily) {
    if (daily.limit_value === null) return { type: 'unlimited', value: '' };
    if (daily.limit_value > 0)     return { type: 'daily',     value: String(daily.limit_value) };
  }

  // Monthly active limit
  if (monthly) {
    if (monthly.limit_value === null) return { type: 'unlimited', value: '' };
    if (monthly.limit_value > 0)     return { type: 'monthly',   value: String(monthly.limit_value) };
  }

  return { type: 'unlimited', value: '' };
}

/** Convert a LimitEntry back to the API shape for one feature. */
function entryToLimitItems(
  feature: string,
  entry: LimitEntry,
): { feature: string; period: string; limit_value: number | null }[] {
  if (entry.type === 'blocked') {
    return [{ feature, period: 'monthly', limit_value: 0 }];
  }
  if (entry.type === 'unlimited') {
    return [{ feature, period: 'monthly', limit_value: null }];
  }
  const numVal = entry.value.trim() === '' ? null : Math.max(1, parseInt(entry.value, 10) || 1);
  if (entry.type === 'daily') {
    return [{ feature, period: 'daily',   limit_value: numVal }];
  }
  return   [{ feature, period: 'monthly', limit_value: numVal }];
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function PackagesPage() {
  const router = useRouter();
  const [packages,  setPackages]  = useState<Package[]>([]);
  const [selected,  setSelected]  = useState<Package | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Package form (create/edit)
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Package | null>(null);
  const [form,      setForm]      = useState<PackageForm>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [confirm,   setConfirm]   = useState<{ msg: string; fn: () => void } | null>(null);

  // Limits editor
  const [editingLimits,  setEditingLimits]  = useState(false);
  const [limitsForm,     setLimitsForm]     = useState<LimitsFormType>({});
  const [savingLimits,   setSavingLimits]   = useState(false);

  const load = useCallback(async (keepSelected?: Package) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/admin/packages`, { headers: hdr() as HeadersInit });
      if (res.status === 403) { router.push('/adminpanel/login'); return; }
      if (!res.ok) throw new Error('Failed to load');
      const data: Package[] = await res.json();
      setPackages(data);
      const sel = keepSelected ?? selected;
      if (sel) {
        const fresh = data.find(p => p.id === sel.id);
        if (fresh) setSelected(fresh);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, []);

  // ── Package CRUD ──────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sort_order: packages.length });
    setShowForm(true);
  };

  const openEdit = (pkg: Package) => {
    setEditing(pkg);
    setForm({
      name: pkg.name, display_name: pkg.display_name, description: pkg.description,
      price_monthly: String(pkg.price_monthly), price_yearly: String(pkg.price_yearly),
      is_active: pkg.is_active, sort_order: pkg.sort_order,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) return;
    setSaving(true); setError(null);
    try {
      const body = JSON.stringify({
        name: form.name.trim().toLowerCase().replace(/\s+/g, '_') || form.display_name.trim().toLowerCase().replace(/\s+/g, '_'),
        display_name: form.display_name.trim(),
        description: form.description.trim(),
        price_monthly: parseFloat(form.price_monthly) || 0,
        price_yearly: parseFloat(form.price_yearly) || 0,
        is_active: form.is_active,
        sort_order: form.sort_order,
      });
      const url = editing ? `${API}/admin/packages/${editing.id}` : `${API}/admin/packages`;
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: hdr() as HeadersInit, body });
      if (!res.ok) throw new Error('Failed to save');
      const saved: Package = await res.json();
      if (editing) {
        setPackages(prev => prev.map(p => p.id === saved.id ? { ...p, ...saved } : p));
        if (selected?.id === saved.id) setSelected(prev => ({ ...prev!, ...saved }));
      } else {
        setPackages(prev => [...prev, { ...saved, limits: [] }]);
      }
      setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/packages/${id}`, { method: 'DELETE', headers: hdr() as HeadersInit });
    setPackages(prev => prev.filter(p => p.id !== id));
    if (selected?.id === id) setSelected(null);
    setConfirm(null);
  };

  const toggleActive = async (pkg: Package) => {
    const res = await fetch(`${API}/admin/packages/${pkg.id}`, {
      method: 'PUT', headers: hdr() as HeadersInit,
      body: JSON.stringify({
        name: pkg.name, display_name: pkg.display_name, description: pkg.description,
        price_monthly: pkg.price_monthly, price_yearly: pkg.price_yearly,
        is_active: !pkg.is_active, sort_order: pkg.sort_order,
      }),
    });
    if (res.ok) {
      const saved: Package = await res.json();
      setPackages(prev => prev.map(p => p.id === saved.id ? { ...p, is_active: saved.is_active } : p));
      if (selected?.id === saved.id) setSelected(prev => ({ ...prev!, is_active: saved.is_active }));
    }
  };

  // ── Limits editor ──────────────────────────────────────────────────────

  const openLimitsEditor = (pkg: Package) => {
    const init: LimitsFormType = {};
    for (const feat of FEATURES) {
      init[feat.key] = parseLimitEntry(pkg.limits, feat.key);
    }
    setLimitsForm(init);
    setEditingLimits(true);
  };

  const handleSaveLimits = async () => {
    if (!selected) return;
    setSavingLimits(true); setError(null);
    try {
      const limits: { feature: string; period: string; limit_value: number | null }[] = [];
      for (const feat of FEATURES) {
        const entry = limitsForm[feat.key] ?? { type: 'unlimited', value: '' };
        limits.push(...entryToLimitItems(feat.key, entry));
      }
      const res = await fetch(`${API}/admin/packages/${selected.id}/limits`, {
        method: 'PUT', headers: hdr() as HeadersInit,
        body: JSON.stringify({ limits }),
      });
      if (!res.ok) throw new Error('Failed to save limits');
      setEditingLimits(false);
      // Reload all packages and update selected
      await load(selected);
    } catch (e: any) { setError(e.message); }
    finally { setSavingLimits(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            📦 Subscription Packages
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Create packages and configure per-feature access limits for each tier.
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{ background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          + New Package
        </button>
      </div>

      {error && (
        <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--error)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && !packages.length ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* ── Package list ── */}
          <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {packages.map(pkg => (
              <div
                key={pkg.id}
                onClick={() => { setSelected(pkg); setEditingLimits(false); setShowForm(false); }}
                style={{
                  background: selected?.id === pkg.id ? 'var(--bg-surface)' : 'var(--bg)',
                  border: `1px solid ${selected?.id === pkg.id ? 'var(--claude-orange)' : 'var(--border, rgba(255,255,255,0.08))'}`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {pkg.display_name}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, borderRadius: 8, padding: '2px 8px',
                    background: pkg.is_active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                    color: pkg.is_active ? '#4ade80' : 'var(--text-secondary)',
                  }}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {pkg.description || <span style={{ fontStyle: 'italic' }}>No description</span>}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--claude-orange)' }}>
                    ${pkg.price_monthly}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-secondary)' }}>/mo</span>
                  </span>
                  {pkg.price_yearly > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      ${pkg.price_yearly}/yr
                    </span>
                  )}
                </div>
                {/* Mini feature status row */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {FEATURES.map(f => {
                    const entry = parseLimitEntry(pkg.limits, f.key);
                    const isBlocked = entry.type === 'blocked';
                    return (
                      <span
                        key={f.key}
                        title={f.label}
                        style={{
                          fontSize: 10, borderRadius: 5, padding: '2px 6px',
                          background: isBlocked ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)',
                          color: isBlocked ? '#f87171' : '#4ade80',
                        }}
                      >
                        {f.icon} {isBlocked ? '✗' : '✓'}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(pkg); }}
                    style={{ flex: 1, background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', border: '1px solid rgba(218,119,86,0.3)', borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}
                  >Edit</button>
                  <button
                    onClick={e => { e.stopPropagation(); toggleActive(pkg); }}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}
                  >{pkg.is_active ? 'Disable' : 'Enable'}</button>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirm({ msg: `Delete package "${pkg.display_name}"?`, fn: () => doDelete(pkg.id) }); }}
                    style={{ background: 'rgba(224,107,107,0.12)', color: 'var(--error, #E06B6B)', border: '1px solid rgba(224,107,107,0.25)', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}
                  >✕</button>
                </div>
              </div>
            ))}

            {packages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: 13 }}>
                No packages yet.<br />Click "+ New Package" to create one.
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div style={{ flex: 1 }}>

            {/* Package create/edit form */}
            {showForm && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border, rgba(255,255,255,0.08))', padding: 24, marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>
                  {editing ? `Edit — ${editing.display_name}` : 'New Package'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Display Name *
                    <input
                      value={form.display_name}
                      onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                      placeholder="e.g. Pro"
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Internal Key {editing ? <span style={{ opacity: 0.5 }}>(read-only)</span> : ''}
                    <input
                      value={editing ? editing.name : (form.name || form.display_name.toLowerCase().replace(/\s+/g, '_'))}
                      onChange={e => !editing && setForm(f => ({ ...f, name: e.target.value }))}
                      readOnly={!!editing}
                      placeholder="e.g. pro"
                      style={{ ...inputStyle, opacity: editing ? 0.5 : 1 }}
                    />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', gridColumn: '1/-1' }}>
                    Description
                    <input
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Short description shown to users"
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Monthly Price ($)
                    <input type="number" min="0" step="0.01" value={form.price_monthly}
                      onChange={e => setForm(f => ({ ...f, price_monthly: e.target.value }))} style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Yearly Price ($)
                    <input type="number" min="0" step="0.01" value={form.price_yearly}
                      onChange={e => setForm(f => ({ ...f, price_yearly: e.target.value }))} style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Sort Order
                    <input type="number" min="0" value={form.sort_order}
                      onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      style={{ width: 14, height: 14 }} />
                    Active (visible to users)
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button onClick={() => setShowForm(false)}
                    style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 7, padding: '9px 0', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={!form.display_name.trim() || saving}
                    style={{ flex: 2, background: form.display_name.trim() ? 'var(--claude-orange)' : 'rgba(218,119,86,0.3)', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: form.display_name.trim() ? 'pointer' : 'not-allowed' }}>
                    {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Package'}
                  </button>
                </div>
              </div>
            )}

            {/* Feature limits panel */}
            {selected && !showForm && (
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border, rgba(255,255,255,0.08))', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selected.display_name} — Feature Limits
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Set access type and limit per feature. Choose daily or monthly period for counted limits.
                    </div>
                  </div>
                  {editingLimits ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingLimits(false)}
                        style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={handleSaveLimits} disabled={savingLimits}
                        style={{ background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {savingLimits ? 'Saving…' : 'Save Limits'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => openLimitsEditor(selected)}
                      style={{ background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', border: '1px solid rgba(218,119,86,0.3)', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Edit Limits
                    </button>
                  )}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                      <th style={thStyle}>Feature</th>
                      <th style={thStyle}>Access Type</th>
                      <th style={thStyle}>Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURES.map((feat, i) => {
                      const entry = editingLimits
                        ? (limitsForm[feat.key] ?? { type: 'unlimited', value: '' })
                        : parseLimitEntry(selected.limits, feat.key);
                      const isLast = i === FEATURES.length - 1;

                      return (
                        <tr key={feat.key} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border, rgba(255,255,255,0.05))' }}>
                          {/* Feature name */}
                          <td style={{ padding: '14px 20px', width: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 18 }}>{feat.icon}</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: feat.color }}>{feat.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{feat.desc}</div>
                              </div>
                            </div>
                          </td>

                          {/* Access type */}
                          <td style={{ padding: '14px 16px' }}>
                            {editingLimits ? (
                              <select
                                value={entry.type}
                                onChange={e => setLimitsForm(prev => ({
                                  ...prev,
                                  [feat.key]: { type: e.target.value as LimitEntry['type'], value: '' },
                                }))}
                                style={{
                                  padding: '7px 10px', borderRadius: 6, fontSize: 13,
                                  background: 'var(--bg)',
                                  border: '1px solid var(--border, rgba(255,255,255,0.15))',
                                  color: 'var(--text-primary)', cursor: 'pointer', minWidth: 150,
                                }}
                              >
                                <option value="blocked">✗ Blocked</option>
                                <option value="unlimited">∞ Unlimited</option>
                                <option value="daily">Daily Limit</option>
                                <option value="monthly">Monthly Limit</option>
                              </select>
                            ) : (
                              <AccessTypeBadge type={entry.type} />
                            )}
                          </td>

                          {/* Limit value */}
                          <td style={{ padding: '14px 20px' }}>
                            {editingLimits ? (
                              (entry.type === 'daily' || entry.type === 'monthly') ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input
                                    type="number"
                                    min="1"
                                    value={entry.value}
                                    onChange={e => setLimitsForm(prev => ({
                                      ...prev,
                                      [feat.key]: { ...prev[feat.key], value: e.target.value },
                                    }))}
                                    placeholder="∞ unlimited"
                                    style={{
                                      width: 110, padding: '7px 10px',
                                      background: 'var(--bg)',
                                      border: '1px solid var(--border, rgba(255,255,255,0.15))',
                                      borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
                                    }}
                                  />
                                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    / {entry.type}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  {entry.type === 'blocked' ? 'No access' : 'No limit'}
                                </span>
                              )
                            ) : (
                              <LimitValueBadge entry={entry} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Legend */}
                {!editingLimits && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border, rgba(255,255,255,0.06))', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#4ade80', fontWeight: 600 }}>∞</span> = Unlimited access
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#f87171', fontWeight: 600 }}>✗</span> = Feature blocked
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>N</span> = N uses per day or month
                    </span>
                  </div>
                )}
              </div>
            )}

            {!selected && !showForm && (
              <div style={{
                background: 'var(--bg-surface)', borderRadius: 12,
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                padding: 60, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13,
              }}>
                Select a package on the left to view and edit its feature limits.
              </div>
            )}
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AccessTypeBadge({ type }: { type: LimitEntry['type'] }) {
  const styles: Record<string, React.CSSProperties> = {
    blocked:   { color: '#f87171', background: 'rgba(248,113,113,0.1)' },
    unlimited: { color: '#4ade80', background: 'rgba(74,222,128,0.1)'  },
    daily:     { color: '#60a5fa', background: 'rgba(96,165,250,0.1)'  },
    monthly:   { color: '#a78bfa', background: 'rgba(167,139,250,0.1)' },
  };
  const labels: Record<string, string> = {
    blocked: '✗ Blocked', unlimited: '∞ Unlimited', daily: 'Daily', monthly: 'Monthly',
  };
  return (
    <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '3px 10px', ...styles[type] }}>
      {labels[type] ?? type}
    </span>
  );
}

function LimitValueBadge({ entry }: { entry: LimitEntry }) {
  if (entry.type === 'blocked')   return <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No access</span>;
  if (entry.type === 'unlimited') return <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No limit</span>;
  if (!entry.value || entry.value === '') {
    return <span style={{ fontSize: 12, color: '#4ade80' }}>∞ per {entry.type}</span>;
  }
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', borderRadius: 6, padding: '3px 10px' }}>
      {entry.value} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>/ {entry.type}</span>
    </span>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 5,
  padding: '8px 10px',
  background: 'var(--bg)',
  border: '1px solid var(--border, rgba(255,255,255,0.1))',
  borderRadius: 7, color: 'var(--text-primary)', fontSize: 13,
  boxSizing: 'border-box',
};

const thStyle: React.CSSProperties = {
  padding: '10px 20px', textAlign: 'left',
  fontSize: 11, fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
