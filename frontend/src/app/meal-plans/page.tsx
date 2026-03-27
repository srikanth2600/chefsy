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
  preferences_json?: { dietary?: string[]; allergies?: string[]; cuisine?: string; health_tagline?: string };
}
interface Options { dietary: string[]; allergy: string[]; cuisine: string[]; }
interface GenerateForm {
  name: string; dietary_preferences: string[]; allergies: string[];
  servings: number; cuisine_preference: string; week_start_date: string;
}
interface BodyData {
  weight: string; weightUnit: 'kg' | 'lbs';
  height: string; heightUnit: 'cm' | 'ft';
  dob: string; gender: string; activityLevel: string; goal: string;
}

const defaultBodyData: BodyData = {
  weight: '', weightUnit: 'kg', height: '', heightUnit: 'cm',
  dob: '', gender: '', activityLevel: '', goal: '',
};

function loadBodyData(): BodyData {
  try { const d = localStorage.getItem('meal_body_data'); return d ? { ...defaultBodyData, ...JSON.parse(d) } : defaultBodyData; }
  catch { return defaultBodyData; }
}
function saveBodyData(d: BodyData) { try { localStorage.setItem('meal_body_data', JSON.stringify(d)); } catch {} }

function toggle(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function fmtWeekStart(iso: string) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return iso.slice(5, 10); }
}
function getNotifyPref(id: number) {
  try { const v = localStorage.getItem(`meal_notify_${id}`); return v === null ? true : v === 'true'; } catch { return true; }
}
function setNotifyPref(id: number, v: boolean) { try { localStorage.setItem(`meal_notify_${id}`, String(v)); } catch {} }

function buildPrefsChip(form: GenerateForm): string {
  const parts: string[] = [];
  if (form.dietary_preferences.length) parts.push(form.dietary_preferences.join(', '));
  if (form.allergies.length) parts.push(`No: ${form.allergies.join(', ')}`);
  if (form.cuisine_preference) parts.push(`${form.cuisine_preference} cuisine`);
  parts.push(`${form.servings} serving${form.servings !== 1 ? 's' : ''}`);
  return parts.join(' · ');
}

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
function PlanCard({ plan, onView, onDelete, onToggleStatus }: { plan: Plan; onView: () => void; onDelete: (e: React.MouseEvent) => void; onToggleStatus: (e: React.MouseEvent) => void }) {
  const dietary = plan.preferences_json?.dietary ?? [];
  const cuisine = plan.preferences_json?.cuisine;
  const isArchived = plan.status === 'archived';
  return (
    <div
      onClick={onView}
      style={{ background: 'var(--bg-surface)', border: `1px solid ${isArchived ? 'rgba(255,255,255,0.04)' : 'var(--border, rgba(255,255,255,0.08))'}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'border-color 0.2s', opacity: isArchived ? 0.65 : 1 }}
      onMouseEnter={e => { if (!isArchived) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(218,119,86,0.4)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isArchived ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'; }}
    >
      <div style={{ padding: '16px 16px 12px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>{plan.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {isArchived && <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.08)', color: 'var(--text-tertiary)', borderRadius: 4, padding: '2px 6px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Archived</span>}
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtDate(plan.created_at)}</span>
          </div>
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
          {plan.week_start_date && <span>📅 {fmtWeekStart(plan.week_start_date)}</span>}
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border, rgba(255,255,255,0.07))' }} />
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
        <NotifyToggle planId={plan.id} />
        {/* Active/Archived toggle */}
        <button onClick={onToggleStatus} title={isArchived ? 'Restore to active' : 'Archive plan'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isArchived ? '#4ade80' : 'var(--text-tertiary)', padding: '4px 6px', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          {isArchived ? (
            <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Restore</>
          ) : (
            <><svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> Archive</>
          )}
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={e => { e.stopPropagation(); onView(); }} style={{ background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>View</button>
        <button onClick={onDelete} title="Delete" style={{ background: 'rgba(224,107,107,0.1)', color: '#E06B6B', border: '1px solid rgba(224,107,107,0.25)', borderRadius: 7, padding: '6px 9px', fontSize: 12, cursor: 'pointer' }}>🗑</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body & Lifestyle Modal
// ---------------------------------------------------------------------------
function BodyModal({ data, onSave, onClose }: { data: BodyData; onSave: (d: BodyData) => void; onClose: () => void }) {
  const [form, setForm] = useState<BodyData>(data);
  const set = (k: keyof BodyData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))',
    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 20, padding: '24px 22px 20px', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Body &amp; Lifestyle</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '3px 0 0' }}>Helps AI tailor calorie &amp; nutrition targets to you.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Weight + Height row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Weight</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" min="1" max="500" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="e.g. 70" style={{ ...inputStyle, flex: 1 }} />
                <select value={form.weightUnit} onChange={e => set('weightUnit', e.target.value as 'kg' | 'lbs')} style={{ ...inputStyle, width: 56, paddingLeft: 6, paddingRight: 4 }}>
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Height</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" min="1" max="300" value={form.height} onChange={e => set('height', e.target.value)} placeholder="e.g. 170" style={{ ...inputStyle, flex: 1 }} />
                <select value={form.heightUnit} onChange={e => set('heightUnit', e.target.value as 'cm' | 'ft')} style={{ ...inputStyle, width: 56, paddingLeft: 6, paddingRight: 4 }}>
                  <option value="cm">cm</option>
                  <option value="ft">ft</option>
                </select>
              </div>
            </div>
          </div>

          {/* DOB + Gender row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Gender</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Activity Level */}
          <div>
            <label style={labelStyle}>Activity Level</label>
            <select value={form.activityLevel} onChange={e => set('activityLevel', e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              <option value="Sedentary">Sedentary (little or no exercise)</option>
              <option value="Lightly Active">Lightly Active (1–3 days/week)</option>
              <option value="Moderately Active">Moderately Active (3–5 days/week)</option>
              <option value="Very Active">Very Active (6–7 days/week)</option>
              <option value="Extremely Active">Extremely Active (athlete / physical job)</option>
            </select>
          </div>

          {/* Goal */}
          <div>
            <label style={labelStyle}>Health Goal</label>
            <select value={form.goal} onChange={e => set('goal', e.target.value)} style={inputStyle}>
              <option value="">Select…</option>
              <option value="Lose Weight">Lose Weight</option>
              <option value="Maintain Weight">Maintain Weight</option>
              <option value="Gain Muscle">Gain Muscle</option>
              <option value="Eat Healthier">Eat Healthier</option>
              <option value="Manage Condition">Manage a Health Condition</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, padding: '10px 0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={() => { saveBodyData(form); onSave(form); onClose(); }} style={{ flex: 2, background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save Profile</button>
        </div>
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
  const [showBodyModal, setShowBodyModal] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterDietary, setFilterDietary] = useState<string[]>([]);
  const [filterCuisine, setFilterCuisine] = useState('');
  const [bodyData, setBodyData]     = useState<BodyData>(defaultBodyData);
  // pendingForm: preferences set via modal, ready to be included in next generate
  const [pendingForm, setPendingForm] = useState<GenerateForm | null>(null);
  const [multiWeekNotice, setMultiWeekNotice] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // LLM provider selection for meal planning
  const [llmProviders, setLlmProviders]           = useState<{ id: string; label: string }[]>([]);
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<string | null>(null);

  const [statusTab, setStatusTab] = useState<'active' | 'archived'>('active');
  const [form, setForm] = useState<GenerateForm>({
    name: '', dietary_preferences: [], allergies: [], servings: 2, cuisine_preference: '', week_start_date: '',
  });

  // Load body data from localStorage on mount
  useEffect(() => { setBodyData(loadBodyData()); }, []);

  useEffect(() => {
    fetch(`${API}/meal-plans/options`).then(r => r.ok ? r.json() : null).then(d => { if (d) setOptions(d); }).catch(() => {});
  }, []);

  const fetchUsage = async () => {
    const token = tok(); if (!token) return;
    try { const r = await fetch(`${API}/meal-plans/usage`, { headers: { Authorization: `Bearer ${token}` } }); if (r.ok) setUsage(await r.json()); } catch {}
  };

  const fetchPlans = async (status = 'active') => {
    const token = tok(); if (!token) { router.push('/'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/meal-plans?status=${status}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { router.push('/'); return; }
      setPlans((await r.json()).plans ?? []);
    } catch { setError('Failed to load meal plans'); }
    finally { setLoading(false); }
  };

  const handleToggleStatus = async (plan: Plan, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = plan.status === 'archived' ? 'active' : 'archived';
    await fetch(`${API}/meal-plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchPlans(statusTab);
  };

  useEffect(() => { fetchPlans(statusTab); fetchUsage(); }, [statusTab]);

  // Fetch LLM providers enabled for meal_plan feature
  useEffect(() => {
    fetch(`${API}/providers?feature=meal_plan`, {
      headers: tok() ? { Authorization: `Bearer ${tok()}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j && Array.isArray(j.providers) && j.providers.length > 0) {
          setLlmProviders(j.providers);
          setSelectedLlmProvider(j.default ?? j.providers[0]?.id ?? null);
        }
      })
      .catch(() => {});
  }, []);

  // Detect multi-week keywords in prompt
  const MULTI_WEEK_RE = /\b(2|two|3|three|4|four|fortnight|fortnightly|bi-?weekly)\s*(week|wk|weeks|wks)/i;

  // Open modal to set preferences (always opens modal)
  const openPrefsModal = () => {
    setUpgradeRequired(false);
    // NOTE: plan name is kept independent from the search text (prompt)
    setForm(f => ({
      ...f,
      name: pendingForm?.name || '',
      dietary_preferences: pendingForm?.dietary_preferences || [],
      allergies: pendingForm?.allergies || [],
      servings: pendingForm?.servings || 2,
      cuisine_preference: pendingForm?.cuisine_preference || '',
      week_start_date: pendingForm?.week_start_date || '',
    }));
    setShowModal(true);
  };

  // "Plan Meal" button handler
  const handlePlanMeal = () => {
    if (pendingForm) {
      // Preferences already set — generate now
      handleGenerate(pendingForm);
    } else {
      openPrefsModal();
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this meal plan?')) return;
    await fetch(`${API}/meal-plans/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` } });
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  // Core generate logic — accepts a form + uses current searchText + bodyData
  const handleGenerate = async (genForm: GenerateForm) => {
    // Detect multi-week request and show notice, but proceed with 1-week plan
    if (MULTI_WEEK_RE.test(searchText)) {
      setMultiWeekNotice(true);
    }
    setGenerating(true); setError('');
    try {
      const res = await fetch(`${API}/meal-plans/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({
          name: genForm.name || undefined,
          dietary_preferences: genForm.dietary_preferences,
          allergies: genForm.allergies,
          servings: genForm.servings,
          cuisine_preference: genForm.cuisine_preference || undefined,
          week_start_date: genForm.week_start_date || undefined,
          extra_context: searchText.trim() || undefined,
          body_lifestyle: (bodyData.weight || bodyData.goal || bodyData.activityLevel) ? bodyData : undefined,
          llm_provider: selectedLlmProvider || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 403) { setUpgradeRequired(true); setShowModal(false); return; }
        throw new Error(json?.detail?.message ?? json?.detail ?? 'Generation failed');
      }
      setShowModal(false);
      setSearchText('');
      setPendingForm(null);
      fetchUsage();
      router.push(`/meal-plans/${encodePlanId(json.plan.id)}`);
    } catch (err: any) { setError(err.message); }
    finally { setGenerating(false); }
  };

  // Modal action: "Set Preferences" — populate textarea, do NOT generate yet
  const handleSetPreferences = () => {
    setPendingForm({ ...form });
    const chip = buildPrefsChip(form);
    // Prepend a short preferences summary to the textarea
    setSearchText(prev => {
      const existing = prev.trim().replace(/^🥦.*$/m, '').trim();
      return existing ? existing + '\n' + chip : chip;
    });
    setShowModal(false);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 80);
  };

  const allPlanDietary = Array.from(new Set(plans.flatMap(p => p.preferences_json?.dietary ?? [])));
  const allPlanCuisine = Array.from(new Set(plans.map(p => p.preferences_json?.cuisine).filter(Boolean))) as string[];

  const filteredPlans = plans.filter(p => {
    if (filterDietary.length > 0 && !filterDietary.some(d => (p.preferences_json?.dietary ?? []).includes(d))) return false;
    if (filterCuisine && p.preferences_json?.cuisine !== filterCuisine) return false;
    return true;
  });

  const hasBodyProfile = !!(bodyData.weight || bodyData.goal || bodyData.activityLevel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* ── Scrollable middle ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 16px 20px' }}>

          {/* Page title */}
          <div style={{ marginBottom: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Your Meal Plans</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>AI-generated 7-day personalised meal plans</p>
          </div>

          {/* Active / Archived tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 10, padding: 4, width: 'fit-content', border: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
            {(['active', 'archived'] as const).map(tab => (
              <button key={tab} onClick={() => setStatusTab(tab)}
                style={{ padding: '6px 16px', fontSize: 12, fontWeight: statusTab === tab ? 700 : 400, borderRadius: 7, border: 'none', cursor: 'pointer', background: statusTab === tab ? 'var(--claude-orange)' : 'transparent', color: statusTab === tab ? '#fff' : 'var(--text-secondary)', transition: 'background 0.15s,color 0.15s', textTransform: 'capitalize' }}>
                {tab}
              </button>
            ))}
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

          {/* Multi-week notice */}
          {multiWeekNotice && (
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>1-Week Plan Generated</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Your request mentioned multiple weeks, but currently we support <strong>7-day (1-week) plans</strong> only. Your plan has been generated for a full week. You can create additional plans for subsequent weeks.
                </div>
              </div>
              <button onClick={() => setMultiWeekNotice(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>✕</button>
            </div>
          )}

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
                  onDelete={e => handleDelete(plan.id, e)}
                  onToggleStatus={e => handleToggleStatus(plan, e)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom search bar ── */}
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

          {/* Pending prefs chip */}
          {pendingForm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Preferences:</span>
              <span style={{ fontSize: 11, background: 'rgba(218,119,86,0.12)', color: 'var(--claude-orange)', borderRadius: 20, padding: '2px 10px', border: '1px solid rgba(218,119,86,0.3)' }}>{buildPrefsChip(pendingForm)}</span>
              <button onClick={() => { setPendingForm(null); setSearchText(''); }} title="Clear preferences" style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>✕</button>
              <button onClick={openPrefsModal} style={{ background: 'none', border: 'none', color: 'var(--claude-orange)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0, fontFamily: 'inherit' }}>Edit</button>
            </div>
          )}

          {/* Input box */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 14, padding: '10px 10px 10px 16px' }}>
            <textarea
              ref={textareaRef}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePlanMeal(); } }}
              placeholder={pendingForm ? 'Add more details… then click Plan Meal to generate' : 'Describe your ideal week… e.g. high-protein vegetarian plan'}
              rows={1}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5, resize: 'none', fontFamily: 'inherit', maxHeight: 80, overflowY: 'auto' }}
            />

            {/* Body & Lifestyle icon button */}
            <button
              onClick={() => setShowBodyModal(true)}
              title="Body & Lifestyle profile"
              style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hasBodyProfile ? 'rgba(218,119,86,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${hasBodyProfile ? 'rgba(218,119,86,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, color: hasBodyProfile ? 'var(--claude-orange)' : 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s,color 0.15s' }}
            >
              {/* Body/person silhouette icon */}
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2.5"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 21v-6H6l2-6h8l2 6h-2v6"/>
                <path strokeLinecap="round" d="M10 21v-3m4 3v-3"/>
              </svg>
            </button>

            {/* Plan Meal button */}
            <button
              onClick={handlePlanMeal}
              disabled={generating}
              style={{ background: generating ? 'rgba(218,119,86,0.5)' : 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
            >
              {generating
                ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Generating…</>
                : pendingForm
                  ? <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L19 7"/></svg> Generate</>
                  : <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg> Plan Meal</>
              }
            </button>
          </div>

          {!pendingForm && (
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '6px 0 0', textAlign: 'center' }}>
              Press <kbd style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 5px', fontSize: 10 }}>Enter</kbd> or click <strong>Plan Meal</strong> to set preferences
            </p>
          )}
        </div>
      </div>

      {/* ── Generate / Preferences Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 20, padding: '26px 24px 22px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Set Plan Preferences</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>Customise your 7-day meal plan.</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Plan name
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Weekly Plan"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
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

              {/* Start date */}
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Plan start date <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>(any day — your plan runs 7 days from here)</span>
                <input type="date" value={form.week_start_date}
                  onChange={e => setForm(f => ({ ...f, week_start_date: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </label>

              <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>Servings per meal</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, servings: Math.max(1, f.servings - 1) }))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border, rgba(255,255,255,0.1))', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', minWidth: 20, textAlign: 'center' }}>{form.servings}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, servings: Math.min(10, f.servings + 1) }))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border, rgba(255,255,255,0.1))', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </label>

              {error && <div style={{ color: 'var(--error, #E06B6B)', fontSize: 12 }}>{error}</div>}

              {/* LLM selector — only shown when multiple models available */}
              {llmProviders.length > 1 && (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>🤖 AI Model</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {llmProviders.map(p => {
                      const sel = selectedLlmProvider === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedLlmProvider(p.id)}
                          style={{
                            padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer',
                            fontWeight: sel ? 600 : 400,
                            background: sel ? 'rgba(218,119,86,0.2)' : 'rgba(255,255,255,0.06)',
                            color: sel ? 'var(--claude-orange)' : 'var(--text-secondary)',
                            border: `1px solid ${sel ? 'rgba(218,119,86,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Two action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, padding: '10px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Cancel</button>
                <button
                  type="button"
                  onClick={handleSetPreferences}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Set in Search →
                </button>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => { setShowModal(false); handleGenerate(form); }}
                  style={{ flex: 1, background: generating ? 'rgba(218,119,86,0.5)' : 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  {generating ? 'Generating…' : '✦ Generate Now'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '-8px 0 0', textAlign: 'center' }}>
                <strong>Set in Search</strong> lets you add more details before generating.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Body & Lifestyle Modal ── */}
      {showBodyModal && (
        <BodyModal
          data={bodyData}
          onSave={d => setBodyData(d)}
          onClose={() => setShowBodyModal(false)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
