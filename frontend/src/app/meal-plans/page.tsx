'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

function encodePlanId(id: number): string {
  try { return btoa(`chefsy:${id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
  catch { return String(id); }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Usage {
  plan: string; daily_limit: number | null; monthly_limit: number | null;
  today_used: number; month_used: number; can_generate: boolean;
}
interface Plan {
  id: number; name: string; description?: string; week_start_date?: string;
  servings: number; status: string; created_at: string; slot_count: number;
  preferences_json?: { dietary?: string[]; allergies?: string[]; cuisine?: string };
}
interface Options { dietary: string[]; allergy: string[]; cuisine: string[]; }
interface GenerateForm {
  name: string; dietary_preferences: string[]; allergies: string[];
  servings: number; cuisine_preference: string;
}

function toggle(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function getNotifyPref(id: number) {
  try { const v = localStorage.getItem(`meal_notify_${id}`); return v === null ? true : v === 'true'; } catch { return true; }
}
function setNotifyPref(id: number, v: boolean) { try { localStorage.setItem(`meal_notify_${id}`, String(v)); } catch {} }

// ---------------------------------------------------------------------------
// Notification toggle
// ---------------------------------------------------------------------------
function NotifyToggle({ planId }: { planId: number }) {
  const [on, setOn] = useState(() => getNotifyPref(planId));
  return (
    <button onClick={e => { e.stopPropagation(); const n = !on; setOn(n); setNotifyPref(planId, n); if (n && typeof Notification !== 'undefined' && Notification.permission !== 'granted') Notification.requestPermission(); }}
      title={on ? 'Notifications on' : 'Notifications off'}
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: on ? 'var(--claude-orange)' : 'var(--text-tertiary)' }}>
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M15 17H20L18.6 15.6C18.2 15.2 18 14.7 18 14.2V10C18 7.4 16.2 5.2 13.7 4.3V4C13.7 2.9 12.9 2 12 2C11.1 2 10.3 2.9 10.3 4V4.3C7.8 5.2 6 7.4 6 10V14.2C6 14.7 5.8 15.2 5.4 15.6L4 17H9M15 17V18C15 19.7 13.7 21 12 21C10.3 21 9 19.7 9 18V17M15 17H9" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ position: 'relative', display: 'inline-block', width: 26, height: 14, borderRadius: 7, background: on ? 'var(--claude-orange)' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 13 : 2, width: 10, height: 10, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------
function PlanCard({ plan, onView, onDelete }: { plan: Plan; onView: () => void; onDelete: (e: React.MouseEvent) => void }) {
  const dietary = plan.preferences_json?.dietary ?? [];
  const cuisine = plan.preferences_json?.cuisine;
  return (
    <div
      onClick={onView}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.08))', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'border-color 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(218,119,86,0.4)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
    >
      <div style={{ padding: '16px 16px 12px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{plan.name}</h3>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{fmtDate(plan.created_at)}</span>
        </div>
        {(dietary.length > 0 || cuisine) && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            {dietary.slice(0, 2).map(d => <span key={d} style={{ fontSize: 10, background: 'rgba(74,222,128,0.12)', color: '#4ade80', borderRadius: 5, padding: '2px 7px' }}>{d}</span>)}
            {cuisine && <span style={{ fontSize: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: 5, padding: '2px 7px' }}>{cuisine}</span>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>🍽️ {plan.slot_count} meals</span>
          <span>👤 {plan.servings} serving{plan.servings !== 1 ? 's' : ''}</span>
          {plan.week_start_date && <span>📅 {plan.week_start_date.slice(5, 10)}</span>}
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border, rgba(255,255,255,0.07))' }} />
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
        <NotifyToggle planId={plan.id} />
        <div style={{ flex: 1 }} />
        <button onClick={e => { e.stopPropagation(); onView(); }} style={{ background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View</button>
        <button onClick={onDelete} title="Delete" style={{ background: 'rgba(224,107,107,0.1)', color: '#E06B6B', border: '1px solid rgba(224,107,107,0.25)', borderRadius: 7, padding: '6px 9px', fontSize: 12, cursor: 'pointer' }}>🗑</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function MealPlansPage() {
  const router = useRouter();
  const [plans, setPlans]           = useState<Plan[]>([]);
  const [options, setOptions]       = useState<Options>({ dietary: [], allergy: [], cuisine: [] });
  const [usage, setUsage]           = useState<Usage | null>(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterDietary, setFilterDietary] = useState<string[]>([]);
  const [filterCuisine, setFilterCuisine] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState<GenerateForm>({
    name: '', dietary_preferences: [], allergies: [], servings: 2, cuisine_preference: '',
  });

  useEffect(() => {
    fetch(`${API}/meal-plans/options`).then(r => r.ok ? r.json() : null).then(d => { if (d) setOptions(d); }).catch(() => {});
  }, []);

  const fetchUsage = async () => {
    const token = tok(); if (!token) return;
    try { const r = await fetch(`${API}/meal-plans/usage`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) setUsage(await r.json()); } catch {}
  };

  const fetchPlans = async () => {
    const token = tok(); if (!token) { router.push('/'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/meal-plans`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { router.push('/'); return; }
      setPlans((await r.json()).plans ?? []);
    } catch { setError('Failed to load meal plans'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPlans(); fetchUsage(); }, []);

  const openModal = () => {
    setUpgradeRequired(false);
    setForm(f => ({ ...f, name: searchText.trim() }));
    setShowModal(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this meal plan?')) return;
    await fetch(`${API}/meal-plans/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` } });
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true); setError('');
    try {
      const res = await fetch(`${API}/meal-plans/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ name: form.name || undefined, dietary_preferences: form.dietary_preferences, allergies: form.allergies, servings: form.servings, cuisine_preference: form.cuisine_preference || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 403) { setUpgradeRequired(true); setShowModal(false); return; }
        throw new Error(json?.detail?.message ?? json?.detail ?? 'Generation failed');
      }
      setShowModal(false); setSearchText(''); fetchUsage();
      router.push(`/meal-plans/${encodePlanId(json.plan.id)}`);
    } catch (err: any) { setError(err.message); }
    finally { setGenerating(false); }
  };

  const allPlanDietary = Array.from(new Set(plans.flatMap(p => p.preferences_json?.dietary ?? [])));
  const allPlanCuisine = Array.from(new Set(plans.map(p => p.preferences_json?.cuisine).filter(Boolean))) as string[];

  const filteredPlans = plans.filter(p => {
    if (filterDietary.length > 0 && !filterDietary.some(d => (p.preferences_json?.dietary ?? []).includes(d))) return false;
    if (filterCuisine && p.preferences_json?.cuisine !== filterCuisine) return false;
    return true;
  });

  return (
    // Full-height flex column so we can pin the search box at the bottom
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* ── Scrollable middle ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px 20px' }}>

          {/* Page title */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Your Meal Plans</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>AI-generated 7-day personalised meal plans</p>
          </div>

          {/* Upgrade banner */}
          {upgradeRequired && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--claude-orange)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>✦</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>Premium Required</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>AI Meal Planner is a Premium feature.</div>
              </div>
              <button onClick={() => router.push('/upgrade')} style={{ background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Upgrade</button>
            </div>
          )}

          {error && <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--error)', fontSize: 12 }}>{error}</div>}

          {/* Filter chips */}
          {plans.length > 0 && (allPlanDietary.length > 0 || allPlanCuisine.length > 0) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filter:</span>
              {allPlanDietary.map(d => { const a = filterDietary.includes(d); return <button key={d} onClick={() => setFilterDietary(prev => toggle(prev, d))} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer', background: a ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: a ? '#4ade80' : 'var(--text-secondary)', border: `1px solid ${a ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)'}` }}>{d}</button>; })}
              {allPlanCuisine.map(c => { const a = filterCuisine === c; return <button key={c} onClick={() => setFilterCuisine(a ? '' : c)} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer', background: a ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.06)', color: a ? '#60a5fa' : 'var(--text-secondary)', border: `1px solid ${a ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)'}` }}>{c}</button>; })}
              {(filterDietary.length > 0 || filterCuisine) && <button onClick={() => { setFilterDietary([]); setFilterCuisine(''); }} style={{ padding: '3px 8px', fontSize: 10, borderRadius: 20, cursor: 'pointer', background: 'transparent', color: 'var(--text-tertiary)', border: '1px solid rgba(255,255,255,0.08)' }}>✕ Clear</button>}
            </div>
          )}

          {/* Plans grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Loading…</div>
          ) : filteredPlans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🍽️</div>
              {plans.length === 0 ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No meal plans yet</div>
                  <div style={{ fontSize: 12 }}>Describe what you want below and click <strong>Plan Meal</strong></div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No plans match filters</div>
                  <button onClick={() => { setFilterDietary([]); setFilterCuisine(''); }} style={{ background: 'none', border: 'none', color: 'var(--claude-orange)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Clear filters</button>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
              {filteredPlans.map(plan => (
                <PlanCard key={plan.id} plan={plan}
                  onView={() => router.push(`/meal-plans/${encodePlanId(plan.id)}`)}
                  onDelete={e => handleDelete(plan.id, e)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom search bar — pinned like AI chat input ── */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', padding: '12px 16px 16px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {/* Usage bar */}
          {usage && (usage.daily_limit !== null || usage.monthly_limit !== null) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {usage.daily_limit !== null && (
                <>
                  <div style={{ height: 3, width: 80, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(100, (usage.today_used / usage.daily_limit) * 100)}%`, background: usage.today_used >= usage.daily_limit ? '#f87171' : 'var(--claude-orange)', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {usage.today_used}/{usage.daily_limit} today
                    {usage.today_used >= usage.daily_limit && <span style={{ color: '#f87171', marginLeft: 4 }}>· Limit reached</span>}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Input box */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 14, padding: '10px 12px 10px 16px' }}>
            <textarea
              ref={textareaRef}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); openModal(); } }}
              placeholder="Describe your ideal week… e.g. high-protein vegetarian plan"
              rows={1}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5, resize: 'none', fontFamily: 'inherit', maxHeight: 80, overflowY: 'auto' }}
            />
            <button
              onClick={openModal}
              style={{ background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Plan Meal
            </button>
          </div>
        </div>
      </div>

      {/* ── Generate modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 20, padding: '26px 24px 22px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Generate Meal Plan</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>AI will create a personalised 7-day plan.</p>
            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Plan name
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Weekly Plan"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
              </label>

              {options.dietary.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>🥦 Dietary
                    {form.dietary_preferences.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--claude-orange)' }}>{form.dietary_preferences.length} selected</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {options.dietary.map(opt => { const s = form.dietary_preferences.includes(opt); return <button key={opt} type="button" onClick={() => setForm(f => ({ ...f, dietary_preferences: toggle(f.dietary_preferences, opt) }))} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontWeight: s ? 600 : 400, background: s ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)', color: s ? '#4ade80' : 'var(--text-secondary)', border: `1px solid ${s ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.1)'}` }}>{opt}</button>; })}
                  </div>
                </div>
              )}

              {options.allergy.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>⚠️ Allergies
                    {form.allergies.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#f87171' }}>{form.allergies.length} selected</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {options.allergy.map(opt => { const s = form.allergies.includes(opt); return <button key={opt} type="button" onClick={() => setForm(f => ({ ...f, allergies: toggle(f.allergies, opt) }))} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontWeight: s ? 600 : 400, background: s ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)', color: s ? '#f87171' : 'var(--text-secondary)', border: `1px solid ${s ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.1)'}` }}>{opt}</button>; })}
                  </div>
                </div>
              )}

              {options.cuisine.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>🌍 Cuisine</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {options.cuisine.map(opt => { const s = form.cuisine_preference === opt; return <button key={opt} type="button" onClick={() => setForm(f => ({ ...f, cuisine_preference: s ? '' : opt }))} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontWeight: s ? 600 : 400, background: s ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.06)', color: s ? '#60a5fa' : 'var(--text-secondary)', border: `1px solid ${s ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}` }}>{opt}</button>; })}
                  </div>
                </div>
              )}

              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>Servings per meal</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, servings: Math.max(1, f.servings - 1) }))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border, rgba(255,255,255,0.1))', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{form.servings}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, servings: Math.min(10, f.servings + 1) }))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border, rgba(255,255,255,0.1))', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </label>

              {error && <div style={{ color: 'var(--error, #E06B6B)', fontSize: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, padding: '10px 0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={generating} style={{ flex: 2, background: generating ? 'rgba(218,119,86,0.5)' : 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}>
                  {generating ? 'Generating…' : '✦ Generate Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
