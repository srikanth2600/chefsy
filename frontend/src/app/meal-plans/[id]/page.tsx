'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const DAY_NAMES  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_TYPES = ['early_morning', 'breakfast', 'mid_breakfast', 'lunch', 'evening_snack', 'dinner', 'bedtime', 'pre_workout', 'post_workout'];
const MEAL_ICONS: Record<string, string> = {
  early_morning: '🌄', breakfast: '🌅', mid_breakfast: '🍎',
  lunch: '☀️', evening_snack: '☕', dinner: '🌙',
  bedtime: '🌙', pre_workout: '💪', post_workout: '🥤',
};
const MEAL_TIMES: Record<string, { h: number; m: number }> = {
  early_morning: { h: 6, m: 30 }, breakfast: { h: 8, m: 0 }, mid_breakfast: { h: 10, m: 30 },
  lunch: { h: 12, m: 0 }, evening_snack: { h: 17, m: 0 }, dinner: { h: 19, m: 0 },
  bedtime: { h: 21, m: 30 }, pre_workout: { h: 6, m: 0 }, post_workout: { h: 8, m: 0 },
};
const MEAL_LABEL: Record<string, string> = {
  early_morning: 'Early Morning', breakfast: 'Breakfast', mid_breakfast: 'Mid-Morning',
  lunch: 'Lunch', evening_snack: 'Evening Snack', dinner: 'Dinner',
  bedtime: 'Bedtime', pre_workout: 'Pre-Workout', post_workout: 'Post-Workout',
};
const MEAL_TIME_LABEL: Record<string, string> = {
  early_morning: '6:30 AM', breakfast: '8:00 AM', mid_breakfast: '10:30 AM',
  lunch: '12:00 PM', evening_snack: '5:00 PM', dinner: '7:00 PM',
  bedtime: '9:30 PM', pre_workout: '6:00 AM', post_workout: '8:00 AM',
};
const MEAL_BG: Record<string, string> = {
  early_morning: 'rgba(251,191,36,0.04)', breakfast: 'rgba(251,191,36,0.04)', mid_breakfast: 'rgba(74,222,128,0.04)',
  lunch: 'rgba(96,165,250,0.04)', evening_snack: 'rgba(251,191,36,0.04)', dinner: 'rgba(167,139,250,0.04)',
  bedtime: 'rgba(167,139,250,0.04)', pre_workout: 'rgba(34,211,238,0.04)', post_workout: 'rgba(34,211,238,0.04)',
};

// ---------------------------------------------------------------------------
// ID decode
// ---------------------------------------------------------------------------
function decodePlanId(encoded: string): number {
  try {
    const pad = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = pad + '='.repeat((4 - (pad.length % 4)) % 4);
    const decoded = atob(padded);
    if (decoded.startsWith('chefsy:')) { const n = parseInt(decoded.slice(7), 10); if (!isNaN(n)) return n; }
  } catch {}
  const n = parseInt(encoded, 10);
  return isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// ICS download
// ---------------------------------------------------------------------------
function downloadICS(plan: PlanDetail['plan'], slots: MealSlot[]) {
  const base = plan.week_start_date ? new Date(plan.week_start_date) : new Date();
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.000', '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chefsy//Meal Planner//EN', 'CALSCALE:GREGORIAN'];
  slots.forEach(slot => {
    const d = new Date(base); d.setDate(d.getDate() + slot.day_index);
    const mt = MEAL_TIMES[slot.meal_type] ?? { h: 12, m: 0 };
    const s = new Date(d); s.setHours(mt.h, mt.m, 0, 0);
    const e2 = new Date(s); e2.setMinutes(e2.getMinutes() + 30);
    const title = slot.recipe_title ?? slot.meal_name ?? slot.meal_json?.title ?? 'Meal';
    const cal = slot.meal_json?.calories_estimate;
    lines.push('BEGIN:VEVENT', `DTSTART:${fmt(s)}`, `DTEND:${fmt(e2)}`,
      `SUMMARY:${MEAL_ICONS[slot.meal_type] ?? ''} ${title}`,
      `DESCRIPTION:${cal ? `${cal} kcal` : ''}`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `${plan.name.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MealSlot {
  id: number; day_index: number; meal_type: string; sort_order?: number;
  recipe_id?: number; meal_name?: string; recipe_title?: string; recipe_key?: string;
  meal_json?: { title?: string; calories_estimate?: number; ingredients_summary?: string[]; notes?: string; tags?: string[] };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDayDate(weekStartDate: string | undefined, dayIndex: number): Date | null {
  if (!weekStartDate) return null;
  const d = new Date(weekStartDate + 'T00:00:00');
  d.setDate(d.getDate() + dayIndex);
  return d;
}
function fmtDayHeading(weekStartDate: string | undefined, dayIndex: number): string {
  const d = getDayDate(weekStartDate, dayIndex);
  if (!d) return DAY_NAMES[dayIndex];
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
function tagStyle(tag: string): { bg: string; color: string } {
  const t = tag.toLowerCase();
  if (/ferment|probiotic|enzyme|gut[\s-]?health/.test(t)) return { bg: 'rgba(74,222,128,0.12)', color: '#4ade80' };
  if (/antioxidant|anti[\s-]?inflam|omega|selenium|potassium|mineral/.test(t)) return { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' };
  if (/well[\s-]?cook|steam|baked|roast|low[\s-]?sodium|cooked/.test(t)) return { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' };
  if (/high[\s-]?protein|protein|muscle|amino/.test(t)) return { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' };
  if (/fiber|fibre|digest|prebiotic/.test(t)) return { bg: 'rgba(34,211,238,0.1)', color: '#22d3ee' };
  return { bg: 'rgba(218,119,86,0.1)', color: 'var(--claude-orange)' };
}
interface PlanDetail {
  plan: { id: number; name: string; description?: string; week_start_date?: string; servings: number; preferences_json?: { dietary?: string[]; allergies?: string[]; cuisine?: string; health_tagline?: string; intro?: string; tips?: string[]; extra_context?: string }; };
  slots: MealSlot[];
  daily_summary: { day_index: number; day_name: string; calories: number }[];
  shopping_list: string[];
}
interface RecipeModal {
  title: string; recipe_key?: string;
  meal_json?: { calories_estimate?: number; ingredients_summary?: string[]; notes?: string };
  fullRecipe?: Record<string, any> | null;
}

// ---------------------------------------------------------------------------
// Recipe popup
// ---------------------------------------------------------------------------
function RecipePopup({ data, onClose, apiBase }: { data: RecipeModal; onClose: () => void; apiBase: string }) {
  const [full, setFull] = useState<Record<string, any> | null>(data.fullRecipe ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data.recipe_key && !full) {
      setLoading(true);
      fetch(`${apiBase}/recipes/${encodeURIComponent(data.recipe_key)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.recipe) setFull(d.recipe); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [data.recipe_key]);

  const recipe = full ?? {};
  const ingredients: any[] = recipe.ingredients ?? (data.meal_json?.ingredients_summary?.map((s: string) => ({ name: s })) ?? []);
  const steps: any[] = recipe.steps ?? recipe.instructions ?? [];
  const calories = recipe.calories_per_serving ?? data.meal_json?.calories_estimate;
  const notes = recipe.notes ?? data.meal_json?.notes;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>{data.title}</h2>
            {calories && <span style={{ fontSize: 12, background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', borderRadius: 6, padding: '2px 8px' }}>{calories} kcal</span>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading recipe details…</div>}
          {(recipe.prep_time || recipe.cook_time || recipe.servings || recipe.difficulty) && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {recipe.prep_time && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⏱ Prep: {recipe.prep_time}</span>}
              {recipe.cook_time && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🍳 Cook: {recipe.cook_time}</span>}
              {recipe.servings && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>👤 Serves {recipe.servings}</span>}
              {recipe.difficulty && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⭐ {recipe.difficulty}</span>}
            </div>
          )}
          {ingredients.length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🧂 Ingredients</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 16px' }}>
                {ingredients.map((ing: any, i: number) => (
                  <span key={i} style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: 'var(--claude-orange)', flexShrink: 0 }}>•</span>
                    {typeof ing === 'string' ? ing : [ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
          {steps.length > 0 && (
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>👨‍🍳 Instructions</h3>
              <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {steps.map((step: any, i: number) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {typeof step === 'string' ? step : step.instruction ?? step.text ?? JSON.stringify(step)}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {notes && (
            <div style={{ background: 'rgba(218,119,86,0.08)', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>💡 {notes}</p>
            </div>
          )}
          <a href={`/?q=${encodeURIComponent(data.title)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'rgba(218,119,86,0.12)', color: 'var(--claude-orange)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            Ask AI Chef for full recipe →
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MealPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: encodedId } = use(params);
  const planId = decodePlanId(encodedId);
  const router = useRouter();

  const [detail, setDetail]             = useState<PlanDetail | null>(null);
  const [loading, setLoading]           = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError]               = useState('');
  const [swapModal, setSwapModal]       = useState<{ slot: MealSlot } | null>(null);
  const [swapSearch, setSwapSearch]     = useState('');
  const [swapLoading, setSwapLoading]   = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [recipeModal, setRecipeModal]   = useState<RecipeModal | null>(null);
  const [selectedDay, setSelectedDay]   = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newStartDate, setNewStartDate]     = useState('');

  const fetchDetail = async () => {
    const token = tok();
    if (!token) { router.push('/'); return; }
    if (!planId) { router.push('/meal-plans'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/meal-plans/${planId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { router.push('/meal-plans'); return; }
      setDetail(await res.json());
    } catch { setError('Failed to load plan'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDetail(); }, [planId]);

  const getSlot = (dayIdx: number, mealType: string) =>
    detail?.slots.find(s => s.day_index === dayIdx && s.meal_type === mealType);

  const openRecipeModal = (slot: MealSlot) => {
    const title = slot.recipe_title ?? slot.meal_name ?? slot.meal_json?.title ?? 'Recipe';
    setRecipeModal({ title, recipe_key: slot.recipe_key, meal_json: slot.meal_json });
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerate all meals? Current meals will be replaced.')) return;
    setRegenerating(true);
    try {
      const res = await fetch(`${API}/meal-plans/${planId}/regenerate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` }, body: JSON.stringify({}),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.detail?.message ?? 'Failed'); }
      setDetail(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setRegenerating(false); }
  };

  const handleSetStartDate = async (dateStr: string) => {
    if (!dateStr || !planId) return;
    try {
      const res = await fetch(`${API}/meal-plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ week_start_date: dateStr }),
      });
      if (!res.ok) throw new Error('Failed to update date');
      setShowDatePicker(false);
      fetchDetail();
    } catch (e: any) { setError(e.message); }
  };

  const handleSwap = async (slotId: number, mealName: string) => {
    setSwapLoading(true);
    try {
      const res = await fetch(`${API}/meal-plans/${planId}/slots/${slotId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ meal_name: mealName }),
      });
      if (!res.ok) throw new Error('Failed to update slot');
      setSwapModal(null); setSwapSearch('');
      await fetchDetail();
    } catch (e: any) { setError(e.message); }
    finally { setSwapLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading meal plan…</div>
    </div>
  );
  if (!detail) return null;
  const { plan, slots, daily_summary, shopping_list } = detail;
  const totalWeeklyKcal = daily_summary.reduce((s, d) => s + d.calories, 0);
  const avgDailyKcal = daily_summary.filter(d => d.calories > 0).length
    ? Math.round(totalWeeklyKcal / daily_summary.filter(d => d.calories > 0).length) : 0;

  // Cell border colors
  const borderColor = 'rgba(255,255,255,0.08)';
  const headerBg    = 'var(--bg-elevated)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

      {/* ── Print styles injected ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #mp-printable, #mp-printable * { visibility: visible !important; }
          #mp-printable { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; background: #fff !important; padding: 12mm !important; box-sizing: border-box !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; visibility: visible !important; }
          .print-ingredients { display: block !important; visibility: visible !important; }
          .mp-table th { background: #f0f0f0 !important; color: #333 !important; border: 1px solid #ccc !important; }
          .mp-table td { border: 1px solid #ddd !important; background: #fff !important; }
          .mp-table .meal-label-cell { background: #fafafa !important; }
          .mp-kcal { color: #b84500 !important; }
          .mp-title { color: #111 !important; }
          .mp-ingredient { color: #555 !important; }
          .shopping-print { display: block !important; visibility: visible !important; }
          @page { size: A4 landscape; margin: 0; }
        }
        @media screen {
          .print-only { display: none; }
          .print-ingredients { display: none; }
          .shopping-print { display: none; }
          .screen-hide { display: none !important; }
        }
        @media print {
          .screen-hide { display: block !important; visibility: visible !important; }
        }
        .meal-grid { display: grid; grid-template-columns: 1fr 1fr; }
        @media (max-width: 600px) { .meal-grid { grid-template-columns: 1fr; } }
        .day-tabs-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .day-tabs-row::-webkit-scrollbar { display: none; }
        .mp-action-row { display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
        @media (max-width: 480px) {
          .mp-action-row button { padding: 6px 9px !important; font-size: 11px !important; }
          .mp-top-row { flex-direction: column; }
        }
      `}</style>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 32px' }}>

        {/* ── Screen-only top bar ── */}
        <div className="no-print" style={{ padding: '16px 16px 0' }}>
          <button onClick={() => router.push('/meal-plans')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/></svg>
            Back to Meal Plans
          </button>

          <div className="mp-top-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>{plan.name}</h1>
              {plan.preferences_json && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                  {(plan.preferences_json.dietary ?? []).map(d => <span key={d} style={{ fontSize: 10, background: 'rgba(74,222,128,0.12)', color: '#4ade80', borderRadius: 5, padding: '2px 7px' }}>{d}</span>)}
                  {plan.preferences_json.cuisine && <span style={{ fontSize: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: 5, padding: '2px 7px' }}>{plan.preferences_json.cuisine}</span>}
                  {(plan.preferences_json.allergies ?? []).map(a => <span key={a} style={{ fontSize: 10, background: 'rgba(248,113,113,0.1)', color: '#f87171', borderRadius: 5, padding: '2px 7px' }}>⚠ {a}</span>)}
                </div>
              )}
              {(avgDailyKcal > 0) && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Avg <strong style={{ color: 'var(--claude-orange)' }}>{avgDailyKcal} kcal/day</strong>
                  {totalWeeklyKcal > 0 && <span style={{ marginLeft: 10 }}>· {totalWeeklyKcal} kcal/week</span>}
                  <span style={{ marginLeft: 10 }}>· {plan.servings} serving{plan.servings !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="mp-action-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
              {/* Set start date */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setNewStartDate(plan.week_start_date ?? ''); setShowDatePicker(v => !v); }}
                  style={{ background: plan.week_start_date ? 'rgba(96,165,250,0.1)' : 'var(--bg-surface)', border: `1px solid ${plan.week_start_date ? 'rgba(96,165,250,0.4)' : 'var(--border)'}`, color: plan.week_start_date ? '#60a5fa' : 'var(--text-secondary)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  📅 {plan.week_start_date ? fmtDayHeading(plan.week_start_date, 0).split(',')[0] : 'Set Dates'}
                </button>
                {showDatePicker && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 12, padding: '14px 16px', minWidth: 240, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 300 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      Plan start date <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 11 }}>(day 1 of 7)</span>
                    </div>
                    <input type="date" value={newStartDate}
                      onChange={e => setNewStartDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => setShowDatePicker(false)} style={{ flex: 1, padding: '7px 0', background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 7, color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                      <button onClick={() => handleSetStartDate(newStartDate)} disabled={!newStartDate} style={{ flex: 2, padding: '7px 0', background: newStartDate ? 'var(--claude-orange)' : 'rgba(218,119,86,0.4)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: newStartDate ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Apply Dates</button>
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => downloadICS(plan, slots)}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                🗓 Calendar
              </button>
              <button onClick={() => setShowShopping(s => !s)}
                style={{ background: showShopping ? 'rgba(218,119,86,0.15)' : 'var(--bg-surface)', border: `1px solid ${showShopping ? 'rgba(218,119,86,0.4)' : 'var(--border)'}`, color: showShopping ? 'var(--claude-orange)' : 'var(--text-primary)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
                🛒 Shopping {showShopping ? '▲' : '▼'}
              </button>
              <button onClick={() => window.print()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                🖨️ Print
              </button>
              <button onClick={handleRegenerate} disabled={regenerating}
                style={{ background: regenerating ? 'rgba(218,119,86,0.4)' : 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                {regenerating ? '⏳ Regenerating…' : '↻ Regenerate'}
              </button>
            </div>
          </div>

          {error && <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: 'var(--error)', fontSize: 12 }}>{error}</div>}

          {/* Shopping list (expandable) */}
          {showShopping && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>🛒 Shopping List</h3>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{shopping_list.length} items</span>
              </div>
              {shopping_list.length === 0
                ? <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No items found in meal data.</div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '4px 14px' }}>
                  {shopping_list.map((item, i) => (
                    <span key={i} style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                      <span style={{ color: 'var(--claude-orange)', flexShrink: 0 }}>•</span>{item}
                    </span>
                  ))}
                </div>}
            </div>
          )}
        </div>

        {/* ── Health banner + Day tabs + Card grid (screen only) ── */}
        <div className="no-print" style={{ padding: '0 16px 28px' }}>

          {/* Intro paragraph */}
          {plan.preferences_json?.intro && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{plan.preferences_json.intro}</p>
            </div>
          )}

          {/* Health tagline banner */}
          {plan.preferences_json?.health_tagline && (
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 12, padding: '11px 16px', marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ color: '#4ade80', fontSize: 15, flexShrink: 0, marginTop: 1 }}>★</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {plan.preferences_json.health_tagline.includes(':') ? (
                  <>
                    <strong style={{ color: '#4ade80' }}>{plan.preferences_json.health_tagline.split(':')[0]}</strong>
                    {': '}{plan.preferences_json.health_tagline.split(':').slice(1).join(':')}
                  </>
                ) : (
                  <strong style={{ color: '#4ade80' }}>{plan.preferences_json.health_tagline}</strong>
                )}
              </span>
            </div>
          )}

          {/* Day tabs */}
          <div className="day-tabs-row" style={{ marginBottom: 20 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const hasMeals = slots.some(s => s.day_index === i);
              const active = selectedDay === i;
              const d = getDayDate(plan.week_start_date, i);
              const label = d
                ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                : DAY_NAMES[i];
              return (
                <button key={i} onClick={() => setSelectedDay(i)} style={{
                  flexShrink: 0, padding: '8px 16px', borderRadius: 22,
                  border: `1px solid ${active ? 'rgba(74,222,128,0.55)' : 'rgba(255,255,255,0.1)'}`,
                  background: active ? 'rgba(74,222,128,0.14)' : 'var(--bg-surface)',
                  color: active ? '#4ade80' : hasMeals ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontWeight: active ? 700 : 500, fontSize: 13,
                  cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Day header — coloured band */}
          {(() => {
            const summary = daily_summary[selectedDay];
            const dayLabel = fmtDayHeading(plan.week_start_date, selectedDay);
            const dayTheme = summary?.day_name && summary.day_name !== DAY_NAMES[selectedDay] ? summary.day_name : null;
            const kcal = summary?.calories ?? 0;
            return (
              <div style={{ background: 'rgba(74,222,128,0.07)', borderLeft: '4px solid rgba(74,222,128,0.5)', borderRadius: '0 10px 10px 0', padding: '14px 18px', marginBottom: 20 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80', letterSpacing: '-0.01em' }}>{dayLabel}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
                  {dayTheme && <span style={{ fontSize: 13, color: '#4ade80', opacity: 0.8 }}>{dayTheme}</span>}
                  {kcal > 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{kcal} kcal total</span>}
                </div>
              </div>
            );
          })()}

          {/* Meal boxes — 2-col grid */}
          {(() => {
            const daySlots = slots
              .filter(s => s.day_index === selectedDay)
              .sort((a, b) => {
                const order = MEAL_TYPES.indexOf(a.meal_type) - MEAL_TYPES.indexOf(b.meal_type);
                return order !== 0 ? order : (a.sort_order ?? 0) - (b.sort_order ?? 0);
              });
            if (daySlots.length === 0) return (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                No meals planned for this day
              </div>
            );
            return (
              <div className="meal-grid" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                {daySlots.map((slot, idx) => {
                  const mj = slot.meal_json;
                  const title = slot.recipe_title ?? slot.meal_name ?? mj?.title ?? '';
                  const kcal = mj?.calories_estimate;
                  const notes = mj?.notes;
                  const tags = mj?.tags ?? [];
                  const hasRecipe = !!(slot.recipe_key || (mj?.ingredients_summary?.length ?? 0) > 0);
                  const label = MEAL_LABEL[slot.meal_type] ?? slot.meal_type;
                  const timeLabel = MEAL_TIME_LABEL[slot.meal_type];
                  // borders: right on even index (left col), bottom on all except last two items
                  const isOdd = idx % 2 === 0; // left column
                  const totalRows = Math.ceil(daySlots.length / 2);
                  const myRow = Math.floor(idx / 2);
                  const isLastRow = myRow === totalRows - 1;
                  return (
                    <div key={slot.id} style={{
                      padding: '20px 20px 16px',
                      borderRight: isOdd ? '1px solid rgba(255,255,255,0.07)' : 'none',
                      borderBottom: isLastRow ? 'none' : '1px solid rgba(255,255,255,0.07)',
                      display: 'flex', flexDirection: 'column', gap: 10,
                      background: 'var(--bg-surface)',
                    }}>
                      {/* Meal type label row — label · time · kcal · Recipe · Swap */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1, minWidth: 0 }}>
                          {label}
                          {timeLabel && <span style={{ fontWeight: 400, marginLeft: 5, letterSpacing: 0, textTransform: 'none', fontSize: 10 }}>· {timeLabel}</span>}
                        </span>
                        {kcal && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--claude-orange)', whiteSpace: 'nowrap', flexShrink: 0 }}>{kcal} kcal</span>}
                        {hasRecipe && (
                          <button onClick={() => openRecipeModal(slot)} style={{ background: 'rgba(218,119,86,0.12)', border: 'none', borderRadius: 5, color: 'var(--claude-orange)', fontSize: 10, cursor: 'pointer', padding: '3px 8px', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0 }}>
                            Recipe
                          </button>
                        )}
                        <button onClick={() => setSwapModal({ slot })} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, color: 'var(--text-secondary)', fontSize: 10, cursor: 'pointer', padding: '3px 8px', fontFamily: 'inherit', flexShrink: 0 }}>
                          Swap
                        </button>
                      </div>

                      {/* Meal name */}
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{title || '—'}</div>

                      {/* Notes/description */}
                      {notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, flexGrow: 1 }}>{notes}</p>}

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {tags.map((tag, ti) => {
                            const ts = tagStyle(tag);
                            return <span key={ti} style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: ts.bg, color: ts.color }}>{tag}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Tips & suggestions */}
          {(plan.preferences_json?.tips ?? []).length > 0 && (
            <div style={{ marginTop: 24, background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>💡</span> Tips &amp; Suggestions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(plan.preferences_json!.tips as string[]).map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Print-only header ── */}
        <div id="mp-printable">
        <div className="print-only" style={{ padding: '0 0 12px', borderBottom: '2px solid #000', marginBottom: 14 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{plan.name}</h1>
          <div style={{ fontSize: 11, color: '#555' }}>
            7-Day Meal Plan · {plan.servings} serving{plan.servings !== 1 ? 's' : ''}
            {avgDailyKcal > 0 && ` · Avg ${avgDailyKcal} kcal/day`}
            {plan.preferences_json?.dietary?.length ? ` · ${plan.preferences_json.dietary.join(', ')}` : ''}
            {plan.preferences_json?.cuisine ? ` · ${plan.preferences_json.cuisine} cuisine` : ''}
          </div>
        </div>

        {/* ── Main meal grid (print only on screen) ── */}
        <div className="screen-hide" style={{ padding: '0 16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="mp-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 640 }}>
            <colgroup>
              <col style={{ width: 88 }} />
              {DAY_NAMES.map(d => <col key={d} />)}
            </colgroup>

            {/* ── Column header: days ── */}
            <thead>
              <tr>
                {/* top-left corner */}
                <th style={{ background: headerBg, border: `1px solid ${borderColor}`, padding: '8px 6px', textAlign: 'left' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Meal</span>
                </th>
                {DAY_NAMES.map((day, i) => {
                  const cal = daily_summary[i]?.calories;
                  return (
                    <th key={day} style={{ background: headerBg, border: `1px solid ${borderColor}`, padding: '8px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{DAY_SHORT[i]}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 400 }}>{day}</div>
                      {cal > 0 && <div className="mp-kcal" style={{ fontSize: 9, fontWeight: 600, color: 'var(--claude-orange)', marginTop: 2 }}>{cal} kcal</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {MEAL_TYPES.map(mealType => (
                <tr key={mealType}>
                  {/* ── Row header: meal type ── */}
                  <td className="meal-label-cell" style={{ background: MEAL_BG[mealType], border: `1px solid ${borderColor}`, padding: '10px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 3 }}>{MEAL_ICONS[mealType]}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{MEAL_LABEL[mealType]}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>{MEAL_TIME_LABEL[mealType]}</div>
                  </td>

                  {/* ── 7 day cells ── */}
                  {Array.from({ length: 7 }, (_, dayIdx) => {
                    const slot = getSlot(dayIdx, mealType);
                    const mj = slot?.meal_json;
                    const title = slot?.recipe_title ?? slot?.meal_name ?? mj?.title ?? '';
                    const kcal  = mj?.calories_estimate;
                    const ingrs = mj?.ingredients_summary ?? [];
                    const hasRecipe = !!(slot?.recipe_key || ingrs.length > 0);

                    return (
                      <td key={dayIdx} style={{
                        background: slot ? MEAL_BG[mealType] : 'transparent',
                        border: `1px solid ${borderColor}`,
                        padding: '8px 7px',
                        verticalAlign: 'top',
                      }}>
                        {slot ? (
                          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 72, gap: 2 }}>
                            {/* Meal name */}
                            <div className="mp-title" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35, flex: 1, wordBreak: 'break-word' }}>
                              {title || '—'}
                            </div>
                            {/* Ingredients (shown on print, hidden on screen) */}
                            <div className="print-ingredients mp-ingredient" style={{ fontSize: 8, color: 'var(--text-tertiary)', lineHeight: 1.3, wordBreak: 'break-word' }}>
                              {ingrs.slice(0, 5).join(' · ')}
                            </div>
                            {/* kcal + action buttons on one line (screen only) */}
                            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'nowrap' }}>
                              {kcal ? (
                                <span className="mp-kcal" style={{ fontSize: 9, fontWeight: 600, color: 'var(--claude-orange)', flexShrink: 0 }}>{kcal} kcal</span>
                              ) : null}
                              <span style={{ flex: 1 }} />
                              {hasRecipe && (
                                <button onClick={() => openRecipeModal(slot)}
                                  style={{ background: 'rgba(218,119,86,0.12)', border: 'none', borderRadius: 4, color: 'var(--claude-orange)', fontSize: 9, cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  View
                                </button>
                              )}
                              <button onClick={() => setSwapModal({ slot })}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 9, cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                Swap
                              </button>
                            </div>
                            {/* kcal for print */}
                            <div className="print-only mp-kcal" style={{ fontSize: 9, fontWeight: 600 }}>
                              {kcal ? `${kcal} kcal` : ''}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 82, color: 'var(--text-secondary)', fontSize: 13, opacity: 0.2 }}>
                            —
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* ── Total row ── */}
              <tr>
                <td style={{ background: headerBg, border: `1px solid ${borderColor}`, padding: '8px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                </td>
                {daily_summary.map(day => (
                  <td key={day.day_index} style={{ background: headerBg, border: `1px solid ${borderColor}`, padding: '8px 7px', textAlign: 'center', verticalAlign: 'middle' }}>
                    {day.calories > 0 ? (
                      <div>
                        <span className="mp-kcal" style={{ fontSize: 11, fontWeight: 700, color: 'var(--claude-orange)' }}>{day.calories}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 2 }}>kcal</span>
                      </div>
                    ) : <span style={{ fontSize: 10, color: 'var(--text-tertiary)', opacity: 0.3 }}>—</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Print-only shopping list ── */}
        <div className="shopping-print" style={{ marginTop: 20, padding: '0 16px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>🛒 Shopping List</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px 16px' }}>
            {shopping_list.map((item, i) => (
              <span key={i} style={{ fontSize: 10, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span>•</span>{item}
              </span>
            ))}
          </div>
        </div>
        </div>{/* end #mp-printable */}

      </div>

      {/* ── Recipe popup ── */}
      {recipeModal && <RecipePopup data={recipeModal} onClose={() => setRecipeModal(null)} apiBase={API} />}

      {/* ── Swap modal ── */}
      {swapModal && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setSwapModal(null); }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: '22px', width: '100%', maxWidth: 360, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Swap Meal</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 14 }}>
              Replacing <strong style={{ color: 'var(--text-primary)' }}>{DAY_NAMES[swapModal.slot.day_index]} {MEAL_LABEL[swapModal.slot.meal_type]}</strong>
            </p>
            <input value={swapSearch} onChange={e => setSwapSearch(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && swapSearch.trim()) handleSwap(swapModal.slot.id, swapSearch.trim()); }}
              placeholder="Enter meal name…"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSwapModal(null)} style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button disabled={!swapSearch.trim() || swapLoading} onClick={() => handleSwap(swapModal.slot.id, swapSearch.trim())}
                style={{ flex: 2, background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: swapSearch.trim() ? 'pointer' : 'not-allowed', opacity: swapSearch.trim() ? 1 : 0.5, fontFamily: 'inherit' }}>
                {swapLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
