'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Plan {
  id: number;
  name: string;
  description?: string;
  week_start_date?: string;
  servings: number;
  status: string;
  created_at: string;
  slot_count: number;
}

interface GenerateForm {
  name: string;
  dietary_preferences: string;
  allergies: string;
  servings: number;
  cuisine_preference: string;
}

export default function MealPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [form, setForm] = useState<GenerateForm>({
    name: '',
    dietary_preferences: '',
    allergies: '',
    servings: 2,
    cuisine_preference: '',
  });

  const fetchPlans = async () => {
    const token = tok();
    if (!token) { router.push('/'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/meal-plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push('/'); return; }
      const json = await res.json();
      setPlans(json.plans ?? []);
    } catch {
      setError('Failed to load meal plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this meal plan?')) return;
    await fetch(`${API}/meal-plans/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok()}` },
    });
    setPlans(prev => prev.filter(p => p.id !== id));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError('');
    try {
      const body = {
        name: form.name || undefined,
        dietary_preferences: form.dietary_preferences ? form.dietary_preferences.split(',').map(s => s.trim()).filter(Boolean) : [],
        allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
        servings: form.servings,
        cuisine_preference: form.cuisine_preference || undefined,
      };
      const res = await fetch(`${API}/meal-plans/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 403) { setUpgradeRequired(true); setShowModal(false); return; }
        throw new Error(json?.detail?.message ?? json?.detail ?? 'Generation failed');
      }
      setShowModal(false);
      router.push(`/meal-plans/${json.plan.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading meal plans…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>My Meal Plans</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            AI-generated weekly meal plans tailored to your preferences
          </p>
        </div>
        <button
          onClick={() => { setUpgradeRequired(false); setShowModal(true); }}
          style={{
            background: 'var(--claude-orange)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md, 12px)',
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Generate Plan
        </button>
      </div>

      {/* Upgrade banner */}
      {upgradeRequired && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--claude-orange)', borderRadius: 'var(--radius-md, 12px)', padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>✦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>Premium Required</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>AI Meal Planner is a Premium feature. Upgrade to unlock it.</div>
          </div>
          <button
            onClick={() => router.push('/upgrade')}
            style={{ background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Upgrade
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: 'var(--error)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Plans grid */}
      {plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No meal plans yet</div>
          <div style={{ fontSize: 13 }}>Generate your first AI meal plan to get started</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {plans.map(plan => (
            <div
              key={plan.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: 'var(--radius-md, 12px)',
                padding: 20,
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{plan.name}</div>
                {plan.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{plan.description}</div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {plan.week_start_date && (
                    <span style={{ fontSize: 11, background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', borderRadius: 6, padding: '2px 8px' }}>
                      Week of {plan.week_start_date}
                    </span>
                  )}
                  <span style={{ fontSize: 11, background: 'var(--bg, rgba(255,255,255,0.06))', color: 'var(--text-secondary)', borderRadius: 6, padding: '2px 8px' }}>
                    {plan.slot_count} meals
                  </span>
                  <span style={{ fontSize: 11, background: 'var(--bg, rgba(255,255,255,0.06))', color: 'var(--text-secondary)', borderRadius: 6, padding: '2px 8px' }}>
                    {plan.servings} servings
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Created {new Date(plan.created_at).toLocaleDateString()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => router.push(`/meal-plans/${plan.id}`)}
                  style={{ flex: 1, background: 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  View Plan
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  style={{ background: 'rgba(224,107,107,0.15)', color: 'var(--error, #E06B6B)', border: '1px solid rgba(224,107,107,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate modal */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg, 16px)', padding: 28, width: '100%', maxWidth: 460, border: '1px solid var(--border, rgba(255,255,255,0.1))' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Generate Meal Plan</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
              AI will create a 7-day personalised meal plan for you.
            </p>
            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Plan name
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="My Weekly Plan"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Dietary preferences <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(comma-separated)</span>
                <input
                  value={form.dietary_preferences}
                  onChange={e => setForm(f => ({ ...f, dietary_preferences: e.target.value }))}
                  placeholder="vegetarian, high-protein"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Allergies / avoid <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(comma-separated)</span>
                <input
                  value={form.allergies}
                  onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                  placeholder="nuts, dairy"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
                  Servings
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.servings}
                    onChange={e => setForm(f => ({ ...f, servings: Number(e.target.value) }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', flex: 1 }}>
                  Cuisine
                  <input
                    value={form.cuisine_preference}
                    onChange={e => setForm(f => ({ ...f, cuisine_preference: e.target.value }))}
                    placeholder="any"
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </label>
              </div>
              {error && <div style={{ color: 'var(--error, #E06B6B)', fontSize: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, padding: '10px 0', fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  style={{ flex: 2, background: generating ? 'rgba(218,119,86,0.5)' : 'var(--claude-orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer' }}
                >
                  {generating ? 'Generating…' : 'Generate Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}