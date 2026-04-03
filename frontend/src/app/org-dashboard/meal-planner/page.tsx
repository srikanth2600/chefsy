'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

interface TemplatePlan {
  id: number;
  name: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  week_start_date: string | null;
  meal_types: string[];
  target_prefs: Record<string, unknown>;
  slot_count: number;
  created_by_name: string | null;
  published_at: string | null;
  created_at: string;
}

const STATUS_TABS = ['all', 'draft', 'published', 'archived'] as const;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:     { bg: 'rgba(234,179,8,0.12)',   color: '#b45309' },
  published: { bg: 'rgba(34,197,94,0.1)',    color: '#16a34a' },
  archived:  { bg: 'rgba(156,163,175,0.15)', color: '#6b7280' },
};

export default function MealPlannerPage() {
  const router = useRouter();
  const [plans,   setPlans]   = useState<TemplatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<typeof STATUS_TABS[number]>('all');
  const [error,   setError]   = useState('');
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [showNew,  setShowNew]  = useState(false);
  const [toast,    setToast]    = useState('');

  const load = (status?: string) => {
    setLoading(true);
    const qs = status && status !== 'all' ? `?status=${status}` : '';
    fetch(`${API}/org/me/custom-meal-planner${qs}`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => {
        if (r.status === 403) throw new Error('module_disabled');
        return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
      })
      .then(d => setPlans(Array.isArray(d) ? d : []))
      .catch(e => setError(e.message === 'module_disabled'
        ? 'Custom Meal Planner is not enabled for your organisation. Ask your Super Admin to enable it.'
        : e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(tab); }, [tab]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const createPlan = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/org/me/custom-meal-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      const { id } = await r.json();
      router.push(`/org-dashboard/meal-planner/${id}`);
    } catch (e: any) { showToast(`Error: ${e.message}`); }
    finally { setCreating(false); }
  };

  const archivePlan = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await fetch(`${API}/org/me/custom-meal-planner/${id}/archive`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok()}` },
    });
    if (r.ok) { showToast('Plan archived.'); load(tab); }
  };

  const publishPlan = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await fetch(`${API}/org/me/custom-meal-planner/${id}/publish`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok()}` },
    });
    if (r.ok) { showToast('Plan published!'); load(tab); }
    else { const d = await r.json(); showToast(d.detail || 'Could not publish.'); }
  };

  const filtered = plans;

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#1e293b', color: '#f8fafc', padding: '10px 18px',
          borderRadius: 8, fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Meal Planner</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Build and publish 7-day template meal plans for your members
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#3b82f6', color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New Plan
        </button>
      </div>

      {/* New plan modal */}
      {showNew && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9998,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>New Meal Plan</div>
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Plan Name *</label>
            <input
              autoFocus
              style={{
                display: 'block', width: '100%', marginTop: 4, marginBottom: 16,
                padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                fontSize: 14, color: '#0f172a', outline: 'none', boxSizing: 'border-box',
              }}
              placeholder="e.g. Diabetic-Friendly Week 1"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createPlan()}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={createPlan}
                disabled={creating || !newName.trim()}
                style={{
                  flex: 1, background: '#3b82f6', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600,
                  cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? 'Creating…' : 'Create & Edit'}
              </button>
              <button
                onClick={() => { setShowNew(false); setNewName(''); }}
                style={{
                  flex: 0, padding: '9px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 16px', borderRadius: '8px 8px 0 0', border: 'none', fontSize: 13,
              cursor: 'pointer', fontWeight: tab === t ? 700 : 400,
              background: tab === t ? '#3b82f6' : 'transparent',
              color: tab === t ? '#fff' : '#64748b',
              textTransform: 'capitalize',
              transition: 'background 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 16px', color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 160, borderRadius: 12, background: '#e2e8f0', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {/* Plans grid */}
      {!loading && !error && (
        filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🥗</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>No plans yet</div>
            <div style={{ fontSize: 13 }}>Create your first template meal plan using the &ldquo;New Plan&rdquo; button.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map(plan => {
              const ss = STATUS_STYLE[plan.status];
              return (
                <div
                  key={plan.id}
                  onClick={() => router.push(`/org-dashboard/meal-planner/${plan.id}`)}
                  style={{
                    background: '#fff', borderRadius: 12, padding: 18,
                    border: '1px solid #e2e8f0', cursor: 'pointer',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#93c5fd'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'; }}
                >
                  {/* Status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: ss.bg, color: ss.color, textTransform: 'capitalize',
                    }}>
                      {plan.status}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {plan.slot_count} slots
                    </span>
                  </div>

                  {/* Name */}
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4, lineHeight: 1.3 }}>
                    {plan.name}
                  </div>
                  {plan.description && (
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {plan.description}
                    </div>
                  )}

                  {/* Meta row */}
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                    {plan.week_start_date && <span>📅 Week of {plan.week_start_date} · </span>}
                    {plan.meal_types?.slice(0, 3).join(', ')}{(plan.meal_types?.length || 0) > 3 ? '…' : ''}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/org-dashboard/meal-planner/${plan.id}`); }}
                      style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, cursor: 'pointer', color: '#0f172a', fontWeight: 600 }}
                    >
                      Edit
                    </button>
                    {plan.status === 'draft' && (
                      <button
                        onClick={e => publishPlan(plan.id, e)}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: 'none', background: '#3b82f6', fontSize: 12, cursor: 'pointer', color: '#fff', fontWeight: 600 }}
                      >
                        Publish
                      </button>
                    )}
                    {plan.status === 'published' && (
                      <button
                        onClick={e => archivePlan(plan.id, e)}
                        style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, cursor: 'pointer', color: '#6b7280', fontWeight: 600 }}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
