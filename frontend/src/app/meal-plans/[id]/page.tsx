'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const MEAL_ICONS: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
const MEAL_TIMES: Record<string, { h: number; m: number }> = {
  breakfast: { h: 8, m: 0 }, lunch: { h: 12, m: 0 }, dinner: { h: 19, m: 0 },
};

// ---------------------------------------------------------------------------
// ID encoding
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
  id: number; day_index: number; meal_type: string;
  recipe_id?: number; meal_name?: string; recipe_title?: string; recipe_key?: string;
  meal_json?: { title?: string; calories_estimate?: number; ingredients_summary?: string[]; notes?: string };
}
interface PlanDetail {
  plan: { id: number; name: string; description?: string; week_start_date?: string; servings: number; preferences_json?: { dietary?: string[]; allergies?: string[]; cuisine?: string }; };
  slots: MealSlot[];
  daily_summary: { day_index: number; day_name: string; calories: number }[];
  shopping_list: string[];
}
interface RecipeModal {
  title: string; recipe_key?: string;
  meal_json?: { calories_estimate?: number; ingredients_summary?: string[]; notes?: string };
  fullRecipe?: Record<string, any> | null;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Recipe popup modal
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
      <div style={{ background: 'var(--bg-surface)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border, rgba(255,255,255,0.1))', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{data.title}</h2>
            {calories && <span style={{ fontSize: 12, background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', borderRadius: 6, padding: '2px 8px' }}>{calories} kcal</span>}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loading && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading recipe details…</div>}

          {/* Quick stats */}
          {(recipe.prep_time || recipe.cook_time || recipe.servings || recipe.difficulty) && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {recipe.prep_time && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⏱ Prep: {recipe.prep_time}</span>}
              {recipe.cook_time && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🍳 Cook: {recipe.cook_time}</span>}
              {recipe.servings && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>👤 Serves {recipe.servings}</span>}
              {recipe.difficulty && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>⭐ {recipe.difficulty}</span>}
            </div>
          )}

          {/* Ingredients */}
          {ingredients.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🧂 Ingredients</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '5px 16px' }}>
                {ingredients.map((ing: any, i: number) => (
                  <span key={i} style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ color: 'var(--claude-orange)', flexShrink: 0 }}>•</span>
                    {typeof ing === 'string' ? ing : [ing.amount, ing.unit, ing.name].filter(Boolean).join(' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          {steps.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>👨‍🍳 Instructions</h3>
              <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {steps.map((step: any, i: number) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {typeof step === 'string' ? step : step.instruction ?? step.text ?? JSON.stringify(step)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div style={{ background: 'rgba(218,119,86,0.08)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>💡 {notes}</p>
            </div>
          )}

          {/* Ask AI button */}
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

  const [detail, setDetail]         = useState<PlanDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError]           = useState('');
  const [swapModal, setSwapModal]   = useState<{ slot: MealSlot } | null>(null);
  const [swapSearch, setSwapSearch] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [recipeModal, setRecipeModal] = useState<RecipeModal | null>(null);

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.detail?.message ?? 'Failed'); }
      setDetail(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setRegenerating(false); }
  };

  const handleSwap = async (slotId: number, mealName: string) => {
    setSwapLoading(true);
    try {
      const res = await fetch(`${API}/meal-plans/${planId}/slots/${slotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
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

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto', padding: '22px 12px 48px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <button onClick={() => router.push('/meal-plans')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/></svg>
            Back to Meal Plans
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.01em' }}>{plan.name}</h1>
          {plan.preferences_json && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(plan.preferences_json.dietary ?? []).map(d => <span key={d} style={{ fontSize: 10, background: 'rgba(74,222,128,0.12)', color: '#4ade80', borderRadius: 5, padding: '2px 7px' }}>{d}</span>)}
              {plan.preferences_json.cuisine && <span style={{ fontSize: 10, background: 'rgba(96,165,250,0.12)', color: '#60a5fa', borderRadius: 5, padding: '2px 7px' }}>{plan.preferences_json.cuisine}</span>}
              {(plan.preferences_json.allergies ?? []).map(a => <span key={a} style={{ fontSize: 10, background: 'rgba(248,113,113,0.1)', color: '#f87171', borderRadius: 5, padding: '2px 7px' }}>⚠ {a}</span>)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
          <button onClick={() => downloadICS(plan, slots)}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            📅 Calendar
          </button>
          <button onClick={() => setShowShopping(s => !s)}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            🛒 Shopping
          </button>
          <button onClick={handleRegenerate} disabled={regenerating}
            style={{ background: regenerating ? 'rgba(218,119,86,0.4)' : 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer' }}>
            {regenerating ? 'Regenerating…' : '↻ Regenerate'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--error)', fontSize: 12 }}>{error}</div>}

      {/* Shopping list */}
      {showShopping && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 18 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🛒 Shopping List</h3>
          {shopping_list.length === 0
            ? <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No items yet.</div>
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '5px 16px' }}>
              {shopping_list.map((item, i) => <span key={i} style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 5 }}><span style={{ color: 'var(--claude-orange)', flexShrink: 0 }}>•</span>{item}</span>)}
            </div>}
        </div>
      )}

      {/* Weekly grid */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '5px 5px', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ width: 76, textAlign: 'left', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, paddingBottom: 2, paddingLeft: 4 }}>Meal</th>
              {DAY_NAMES.map((day, i) => (
                <th key={day} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600, paddingBottom: 2 }}>
                  {DAY_SHORT[i]}
                  {daily_summary[i]?.calories > 0 && <div style={{ fontSize: 9, color: 'var(--claude-orange)', fontWeight: 500 }}>{daily_summary[i].calories}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map(mealType => (
              <tr key={mealType}>
                <td style={{ verticalAlign: 'middle', paddingLeft: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                    <span style={{ fontSize: 15 }}>{MEAL_ICONS[mealType]}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600, letterSpacing: '0.04em' }}>{mealType}</span>
                  </div>
                </td>
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const slot = getSlot(dayIdx, mealType);
                  const mj = slot?.meal_json;
                  return (
                    <td key={dayIdx} style={{ verticalAlign: 'top' }}>
                      <div style={{ background: slot ? 'var(--bg-surface)' : 'rgba(255,255,255,0.015)', border: `1px solid ${slot ? 'var(--border, rgba(255,255,255,0.09))' : 'transparent'}`, borderRadius: 9, padding: slot ? '9px 8px 7px' : '9px 6px', minHeight: 75, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {slot ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1 }}>
                              {slot.recipe_title ?? slot.meal_name ?? mj?.title ?? '—'}
                            </div>
                            {mj?.calories_estimate ? <div style={{ fontSize: 9, color: 'var(--claude-orange)', fontWeight: 500 }}>{mj.calories_estimate} kcal</div> : null}
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(slot.recipe_key || mj?.ingredients_summary?.length) ? (
                                <button onClick={() => openRecipeModal(slot)}
                                  style={{ background: 'rgba(218,119,86,0.12)', border: 'none', borderRadius: 4, color: 'var(--claude-orange)', fontSize: 9, cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit', fontWeight: 600 }}>
                                  View recipe
                                </button>
                              ) : null}
                              <button onClick={() => setSwapModal({ slot })}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 9, cursor: 'pointer', padding: '2px 6px', fontFamily: 'inherit' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(218,119,86,0.15)'; (e.currentTarget as HTMLElement).style.color = 'var(--claude-orange)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                                Swap
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ color: 'var(--text-secondary)', fontSize: 10, opacity: 0.25, margin: 'auto', textAlign: 'center' }}>—</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recipe popup */}
      {recipeModal && <RecipePopup data={recipeModal} onClose={() => setRecipeModal(null)} apiBase={API} />}

      {/* Swap modal */}
      {swapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setSwapModal(null); }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: '22px', width: '100%', maxWidth: 360, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Swap Meal</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 14 }}>
              Replacing <strong style={{ color: 'var(--text-primary)' }}>{DAY_NAMES[swapModal.slot.day_index]} {swapModal.slot.meal_type}</strong>
            </p>
            <input value={swapSearch} onChange={e => setSwapSearch(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && swapSearch.trim()) handleSwap(swapModal.slot.id, swapSearch.trim()); }}
              placeholder="Enter meal name…"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSwapModal(null)} style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 0', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button disabled={!swapSearch.trim() || swapLoading} onClick={() => handleSwap(swapModal.slot.id, swapSearch.trim())}
                style={{ flex: 2, background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: swapSearch.trim() ? 'pointer' : 'not-allowed', opacity: swapSearch.trim() ? 1 : 0.5 }}>
                {swapLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
