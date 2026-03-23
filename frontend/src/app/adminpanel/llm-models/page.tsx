'use client';
/**
 * Admin /adminpanel/llm-models
 * Manage LLM models and configure which models are enabled per package.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' });

type LLMModel = {
  id: number;
  name: string;
  provider: string;
  model_id: string;
  api_key?: string;
  base_url?: string;
  is_active: boolean;
  is_default: boolean;
  notes?: string;
  created_at: string;
  // Package access fields (only present in package view)
  enabled?: boolean;
  is_pkg_default?: boolean;
  features?: string[];
};

const FEATURE_OPTIONS = [
  { key: 'ai_recipe', label: 'AI Recipe', icon: '🍳' },
  { key: 'meal_plan', label: 'Meal Plan', icon: '🥗' },
];

type Package = { id: number; name: string; display_name: string; is_active: boolean };

const PROVIDER_COLORS: Record<string, string> = {
  openai:  '#10a37f',
  groq:    '#f55036',
  ollama:  '#7c3aed',
  custom:  '#60a5fa',
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI', groq: 'Groq', ollama: 'Ollama', custom: 'Custom',
};

const EMPTY_FORM = {
  name: '', provider: 'groq', model_id: '', api_key: '', base_url: '', is_active: true, is_default: false, notes: '',
};

export default function LLMModelsPage() {
  const router = useRouter();
  const [models,    setModels]    = useState<LLMModel[]>([]);
  const [packages,  setPackages]  = useState<Package[]>([]);
  const [selPkg,    setSelPkg]    = useState<Package | null>(null);
  const [pkgModels, setPkgModels] = useState<LLMModel[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<LLMModel | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_FORM });
  const [saving,    setSaving]    = useState(false);
  const [confirm,   setConfirm]   = useState<{ msg: string; fn: () => void } | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/admin/llm-models`, { headers: hdr() as HeadersInit });
      if (res.status === 403) { router.push('/adminpanel/login'); return; }
      if (!res.ok) throw new Error('Failed to load LLM models');
      setModels(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const loadPackages = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/packages`, { headers: hdr() as HeadersInit });
      if (res.ok) setPackages(await res.json());
    } catch {}
  }, []);

  const loadPkgAccess = useCallback(async (pkg: Package) => {
    try {
      const res = await fetch(`${API}/admin/packages/${pkg.id}/llm-access`, { headers: hdr() as HeadersInit });
      if (res.ok) {
        const data = await res.json();
        setPkgModels(data.models ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => { loadModels(); loadPackages(); }, []);

  useEffect(() => {
    if (selPkg) loadPkgAccess(selPkg);
  }, [selPkg]);

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setShowForm(true); };
  const openEdit = (m: LLMModel) => {
    setEditing(m);
    setForm({ name: m.name, provider: m.provider, model_id: m.model_id, api_key: m.api_key ?? '', base_url: m.base_url ?? '', is_active: m.is_active, is_default: m.is_default, notes: m.notes ?? '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.model_id.trim()) return;
    setSaving(true); setError(null);
    try {
      const url = editing ? `${API}/admin/llm-models/${editing.id}` : `${API}/admin/llm-models`;
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: hdr() as HeadersInit, body: JSON.stringify(form) });
      if (!res.ok) throw new Error('Failed to save');
      setShowForm(false);
      await loadModels();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/llm-models/${id}`, { method: 'DELETE', headers: hdr() as HeadersInit });
    setModels(prev => prev.filter(m => m.id !== id));
    setConfirm(null);
  };

  const togglePkgAccess = async (pkg: Package, model: LLMModel, enabled: boolean, isDefault: boolean, features?: string[]) => {
    await fetch(`${API}/admin/packages/${pkg.id}/llm-access`, {
      method: 'PUT', headers: hdr() as HeadersInit,
      body: JSON.stringify({
        llm_model_id: model.id,
        enabled,
        is_default: isDefault,
        features: features ?? model.features ?? ['ai_recipe', 'meal_plan'],
      }),
    });
    await loadPkgAccess(pkg);
  };

  const toggleFeature = async (pkg: Package, model: LLMModel, feature: string, checked: boolean) => {
    const current = model.features ?? ['ai_recipe', 'meal_plan'];
    const next = checked ? [...new Set([...current, feature])] : current.filter(f => f !== feature);
    await togglePkgAccess(pkg, model, true, model.is_pkg_default ?? false, next);
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🤖 LLM Models</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Manage AI language models and configure which models are available per subscription package.
          </p>
        </div>
        <button onClick={openAdd} style={{ background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + New LLM Model
        </button>
      </div>

      {error && <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--error)', fontSize: 13 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* LEFT: Model list */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>All LLM Models</div>

          {/* Create/Edit form */}
          {showForm && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-primary)' }}>
                {editing ? `Edit — ${editing.name}` : 'New LLM Model'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={labelStyle}>
                  Display Name *
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. GPT-4o Mini" style={inputStyle} />
                </label>
                <label style={labelStyle}>
                  Provider *
                  <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} style={inputStyle}>
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                    <option value="ollama">Ollama</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label style={labelStyle}>
                  Model ID *
                  <input value={form.model_id} onChange={e => setForm(f => ({ ...f, model_id: e.target.value }))} placeholder="e.g. gpt-4o-mini, llama-3.1-8b-instant" style={inputStyle} />
                </label>
                <label style={labelStyle}>
                  API Key
                  <input value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder="sk-..." type="password" style={inputStyle} />
                </label>
                <label style={{ ...labelStyle, gridColumn: '1/-1' }}>
                  Base URL (optional)
                  <input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://api.groq.com/openai/v1" style={inputStyle} />
                </label>
                <label style={{ ...labelStyle, gridColumn: '1/-1' }}>
                  Notes
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional description" style={inputStyle} />
                </label>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 14, height: 14 }} />
                  Active
                </label>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} style={{ width: 14, height: 14 }} />
                  Global Default
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 7, padding: '8px 0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={!form.name.trim() || !form.model_id.trim() || saving} style={{ flex: 2, background: form.name.trim() && form.model_id.trim() ? 'var(--claude-orange)' : 'rgba(218,119,86,0.3)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Model'}
                </button>
              </div>
            </div>
          )}

          {loading && !models.length ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {models.map(m => (
                <div key={m.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px', background: PROVIDER_COLORS[m.provider] + '22', color: PROVIDER_COLORS[m.provider] }}>
                        {PROVIDER_LABELS[m.provider] ?? m.provider}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</span>
                      {m.is_default && <span style={{ fontSize: 10, background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', borderRadius: 5, padding: '1px 6px' }}>Default</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, borderRadius: 8, padding: '2px 8px', background: m.is_active ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', color: m.is_active ? '#4ade80' : 'var(--text-secondary)' }}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontFamily: 'monospace' }}>{m.model_id}</div>
                  {m.base_url && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, opacity: 0.7 }}>{m.base_url}</div>}
                  {m.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontStyle: 'italic' }}>{m.notes}</div>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(m)} style={{ flex: 1, background: 'rgba(218,119,86,0.12)', color: 'var(--claude-orange)', border: '1px solid rgba(218,119,86,0.25)', borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => setConfirm({ msg: `Delete "${m.name}"?`, fn: () => doDelete(m.id) })} style={{ background: 'rgba(224,107,107,0.12)', color: 'var(--error, #E06B6B)', border: '1px solid rgba(224,107,107,0.25)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              ))}
              {models.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)', fontSize: 13 }}>No LLM models yet. Click "+ New LLM Model" to add one.</div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Package access configuration */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Package LLM Access</div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            Select a package to configure which LLM models are available for its users. Toggle to enable/disable, and mark one as default.
          </p>

          {/* Package selector */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {packages.map(pkg => (
              <button
                key={pkg.id}
                onClick={() => setSelPkg(pkg)}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                  background: selPkg?.id === pkg.id ? 'var(--claude-orange)' : 'var(--bg-surface)',
                  borderColor: selPkg?.id === pkg.id ? 'var(--claude-orange)' : 'var(--border, rgba(255,255,255,0.1))',
                  color: selPkg?.id === pkg.id ? '#fff' : 'var(--text-primary)',
                }}
              >
                {pkg.display_name}
              </button>
            ))}
          </div>

          {selPkg && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.07))' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selPkg.display_name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>— LLM Access</span>
              </div>
              <div style={{ padding: 4 }}>
                {pkgModels.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)', fontSize: 13 }}>No LLM models found. Add models first.</div>
                )}
                {pkgModels.map(m => (
                  <div key={m.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, rgba(255,255,255,0.05))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px', background: PROVIDER_COLORS[m.provider] + '22', color: PROVIDER_COLORS[m.provider], flexShrink: 0 }}>
                        {PROVIDER_LABELS[m.provider] ?? m.provider}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{m.model_id}</div>
                      </div>

                      {/* Default button (only when enabled) */}
                      {m.enabled && (
                        <button
                          onClick={() => togglePkgAccess(selPkg, m, true, !m.is_pkg_default)}
                          title={m.is_pkg_default ? 'Currently default for this package' : 'Set as default for this package'}
                          style={{
                            padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '1px solid', cursor: 'pointer', fontWeight: 600, flexShrink: 0,
                            background: m.is_pkg_default ? 'rgba(218,119,86,0.15)' : 'transparent',
                            borderColor: m.is_pkg_default ? 'rgba(218,119,86,0.4)' : 'var(--border, rgba(255,255,255,0.1))',
                            color: m.is_pkg_default ? 'var(--claude-orange)' : 'var(--text-secondary)',
                          }}
                        >
                          {m.is_pkg_default ? '★ Default' : '☆ Set Default'}
                        </button>
                      )}

                      {/* Enable/disable toggle */}
                      <div
                        onClick={() => togglePkgAccess(selPkg, m, !m.enabled, m.is_pkg_default && !m.enabled ? false : m.is_pkg_default ?? false)}
                        style={{
                          width: 36, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                          background: m.enabled ? 'var(--claude-orange)' : 'rgba(255,255,255,0.12)',
                        }}
                        title={m.enabled ? 'Disable for this package' : 'Enable for this package'}
                      >
                        <div style={{
                          position: 'absolute', top: 2, left: m.enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
                          background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                      </div>
                    </div>

                    {/* Feature checkboxes — shown only when model is enabled */}
                    {m.enabled && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingLeft: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>Enable for:</span>
                        {FEATURE_OPTIONS.map(f => {
                          const active = (m.features ?? ['ai_recipe', 'meal_plan']).includes(f.key);
                          return (
                            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12 }}>
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={e => toggleFeature(selPkg, m, f.key, e.target.checked)}
                                style={{ width: 13, height: 13, accentColor: 'var(--claude-orange)' }}
                              />
                              <span style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {f.icon} {f.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {pkgModels.some(m => m.enabled) && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border, rgba(255,255,255,0.06))', fontSize: 12, color: 'var(--text-secondary)' }}>
                  ℹ️ Enable each LLM for specific features (AI Recipe / Meal Plan). If only one LLM is enabled for a feature, users won&apos;t see a dropdown — it&apos;s auto-selected. Multiple enabled models show a dropdown in the chat.
                </div>
              )}
            </div>
          )}
          {!selPkg && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              Select a package above to configure LLM access.
            </div>
          )}
        </div>
      </div>

      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary)', display: 'block' };
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', marginTop: 5,
  padding: '8px 10px', background: 'var(--bg)',
  border: '1px solid var(--border, rgba(255,255,255,0.1))',
  borderRadius: 7, color: 'var(--text-primary)', fontSize: 13,
  boxSizing: 'border-box',
};
