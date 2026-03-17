'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
const MEAL_ICONS: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

interface MealSlot {
  id: number;
  day_index: number;
  meal_type: string;
  recipe_id?: number;
  meal_name?: string;
  meal_json?: { title?: string; calories_estimate?: number; ingredients_summary?: string[]; notes?: string };
  recipe_title?: string;
  recipe_key?: string;
  image_path?: string;
}

interface PlanDetail {
  plan: {
    id: number;
    name: string;
    description?: string;
    week_start_date?: string;
    servings: number;
    preferences_json?: { dietary?: string[]; allergies?: string[]; cuisine?: string };
  };
  slots: MealSlot[];
  daily_summary: { day_index: number; day_name: string; calories: number }[];
  shopping_list: string[];
}

export default function MealPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [swapModal, setSwapModal] = useState<{ slot: MealSlot } | null>(null);
  const [swapSearch, setSwapSearch] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [showShopping, setShowShopping] = useState(false);

  const fetchDetail = async () => {
    const token = tok();
    if (!token) { router.push('/'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/meal-plans/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { router.push('/meal-plans'); return; }
      setDetail(await res.json());
    } catch {
      setError('Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);

  const getSlot = (dayIdx: number, mealType: string): MealSlot | undefined =>
    detail?.slots.find(s => s.day_index === dayIdx && s.meal_type === mealType);

  const handleRegenerate = async () => {
    if (!confirm('Regenerate all meals in this plan? Current meals will be replaced.')) return;
    setRegenerating(true);
    try {
      const res = await fetch(`${API}/meal-plans/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.detail?.message ?? j?.detail ?? 'Regeneration failed');
      }
      setDetail(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleSwap = async (slotId: number, mealName: string) => {
    setSwapLoading(true);
    try {
      const res = await fetch(`${API}/meal-plans/${id}/slots/${slotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ meal_name: mealName }),
      });
      if (!res.ok) throw new Error('Failed to update slot');
      setSwapModal(null);
      setSwapSearch('');
      await fetchDetail();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSwapLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading meal plan…</div>
      </div>
    );
  }

  if (!detail) return null;

  const { plan, slots, daily_summary, shopping_list } = detail;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button
            onClick={() => router.push('/meal-plans')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 8 }}
          >
            ← Back to Meal Plans
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{plan.name}</h1>
          {plan.description && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{plan.description}</p>}
          {plan.preferences_json && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {(plan.preferences_json.dietary ?? []).map(d => (
                <span key={d} style={{ fontSize: 11, background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', borderRadius: 6, padding: '2px 8px' }}>{d}</span>
              ))}
              {plan.preferences_json.cuisine && (
                <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', borderRadius: 6, padding: '2px 8px' }}>{plan.preferences_json.cuisine}</span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowShopping(s => !s)}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.1))', color: 'var(--text-primary)', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}
          >
            🛒 Shopping List
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{ background: regenerating ? 'rgba(218,119,86,0.4)' : 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: regenerating ? 'not-allowed' : 'pointer' }}
          >
            {regenerating ? 'Regenerating…' : '↻ Regenerate'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: 'var(--error)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Shopping list panel */}
      {showShopping && shopping_list.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 12, padding: '18px 20px', marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🛒 Shopping List</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {shopping_list.map((item, i) => (
              <span key={i} style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--claude-orange)' }}>•</span> {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weekly calendar grid */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 8, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 90, textAlign: 'left', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, paddingBottom: 4 }}>Meal</th>
              {DAY_NAMES.map((day, i) => (
                <th key={day} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500, paddingBottom: 4 }}>
                  <div>{DAY_SHORT[i]}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', opacity: 0.6 }}>
                    {daily_summary[i]?.calories > 0 ? `${daily_summary[i].calories} kcal` : ''}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_TYPES.map(mealType => (
              <tr key={mealType}>
                <td style={{ verticalAlign: 'middle', paddingRight: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{MEAL_ICONS[mealType]}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 500 }}>{mealType}</span>
                  </div>
                </td>
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const slot = getSlot(dayIdx, mealType);
                  const mj = slot?.meal_json;
                  return (
                    <td key={dayIdx} style={{ verticalAlign: 'top' }}>
                      <div
                        style={{
                          background: slot ? 'var(--bg-surface)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${slot ? 'var(--border, rgba(255,255,255,0.1))' : 'transparent'}`,
                          borderRadius: 10,
                          padding: slot ? '10px 10px 8px' : '10px',
                          minHeight: 80,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        {slot ? (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {slot.recipe_title ?? slot.meal_name ?? mj?.title ?? '—'}
                            </div>
                            {mj?.calories_estimate ? (
                              <div style={{ fontSize: 11, color: 'var(--claude-orange)' }}>{mj.calories_estimate} kcal</div>
                            ) : null}
                            {slot.recipe_key && (
                              <button
                                onClick={() => router.push(`/`)}
                                style={{ marginTop: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 10, cursor: 'pointer', textAlign: 'left', padding: 0, textDecoration: 'underline' }}
                              >
                                View recipe
                              </button>
                            )}
                            <button
                              onClick={() => setSwapModal({ slot })}
                              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 5, color: 'var(--text-secondary)', fontSize: 10, cursor: 'pointer', padding: '3px 6px', alignSelf: 'flex-start' }}
                            >
                              Swap
                            </button>
                          </>
                        ) : (
                          <div style={{ color: 'var(--text-secondary)', fontSize: 11, opacity: 0.4, margin: 'auto', textAlign: 'center' }}>—</div>
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

      {/* Swap modal */}
      {swapModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setSwapModal(null); }}
        >
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Swap Meal</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>
              Replacing <strong style={{ color: 'var(--text-primary)' }}>{DAY_NAMES[swapModal.slot.day_index]} {swapModal.slot.meal_type}</strong>
            </p>
            <input
              value={swapSearch}
              onChange={e => setSwapSearch(e.target.value)}
              placeholder="Enter meal name…"
              style={{ width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setSwapModal(null)}
                style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, padding: '9px 0', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={!swapSearch.trim() || swapLoading}
                onClick={() => handleSwap(swapModal.slot.id, swapSearch.trim())}
                style={{ flex: 2, background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: swapSearch.trim() ? 'pointer' : 'not-allowed', opacity: swapSearch.trim() ? 1 : 0.5 }}
              >
                {swapLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}