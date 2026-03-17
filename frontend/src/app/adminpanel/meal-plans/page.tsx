'use client';
/**
 * Admin  /adminpanel/meal-plans
 * APIs:
 *   GET    /admin/meal-plans?q=&status=&page=&per_page=
 *   GET    /admin/meal-plans/:id
 *   DELETE /admin/meal-plans/:id
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ConfirmDialog, Pagination, DetailRow } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_ICONS: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

type MealPlan = {
  id: number;
  name: string;
  description?: string;
  week_start_date?: string;
  servings: number;
  status: string;
  created_at: string;
  user_id: number;
  user_name: string;
  user_email: string;
  slot_count: number;
};

type MealSlot = {
  id: number;
  day_index: number;
  meal_type: string;
  recipe_id?: number;
  meal_name?: string;
  meal_json?: Record<string, any>;
  recipe_title?: string;
  recipe_key?: string;
};

type PlanDetail = {
  plan: MealPlan & { preferences_json?: Record<string, any> };
  slots: MealSlot[];
};

export default function AdminMealPlansPage() {
  const router = useRouter();
  const [plans, setPlans]   = useState<MealPlan[]>([]);
  const [total, setTotal]   = useState(0);
  const [page,  setPage]    = useState(1);
  const [q,     setQ]       = useState('');
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [selected, setSelected] = useState<PlanDetail | null>(null);
  const [confirm, setConfirm]   = useState<{ msg: string; fn: () => void } | null>(null);
  const perPage = 20;

  const load = useCallback(async (pg = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, status, page: String(pg), per_page: String(perPage) });
      const res = await fetch(`${API}/admin/meal-plans?${params}`, { headers: hdr() as HeadersInit });
      if (res.status === 403) { router.push('/adminpanel/login'); return; }
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setPlans(json.plans ?? []);
      setTotal(json.total ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, status, page]);

  useEffect(() => { load(1); setPage(1); }, [q, status]);
  useEffect(() => { load(page); }, [page]);

  const openDetail = async (id: number) => {
    try {
      const res = await fetch(`${API}/admin/meal-plans/${id}`, { headers: hdr() as HeadersInit });
      if (!res.ok) throw new Error('Failed to load detail');
      setSelected(await res.json());
    } catch (e: any) {
      setError(e.message);
    }
  };

  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/meal-plans/${id}`, { method: 'DELETE', headers: hdr() as HeadersInit });
    setPlans(prev => prev.filter(p => p.id !== id));
    setTotal(t => t - 1);
    setSelected(null);
    setConfirm(null);
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          🍽️ Meal Plans
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          View and manage all user-generated meal plans. Total: <strong>{total}</strong>
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by user or plan name…"
          style={{ flex: '1 1 220px', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13 }}
        />
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          style={{ padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13 }}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {error && (
        <div style={{ background: '#3a1a1a', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--error)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border, rgba(255,255,255,0.08))', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))' }}>
              {['ID', 'Plan Name', 'User', 'Week Start', 'Meals', 'Servings', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading…</td></tr>
            ) : plans.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>No meal plans found</td></tr>
            ) : plans.map((p, i) => (
              <tr
                key={p.id}
                style={{ borderBottom: i < plans.length - 1 ? '1px solid var(--border, rgba(255,255,255,0.05))' : 'none' }}
              >
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>#{p.id}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                  {p.description && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{p.description.slice(0, 50)}{p.description.length > 50 ? '…' : ''}</div>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{p.user_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.user_email}</div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {p.week_start_date ?? '—'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', textAlign: 'center' }}>
                  {p.slot_count}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {p.servings}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => openDetail(p.id)}
                      style={{ background: 'rgba(218,119,86,0.15)', color: 'var(--claude-orange)', border: '1px solid rgba(218,119,86,0.3)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}
                    >
                      View
                    </button>
                    <button
                      onClick={() => setConfirm({ msg: `Delete plan "${p.name}"?`, fn: () => doDelete(p.id) })}
                      style={{ background: 'rgba(224,107,107,0.12)', color: 'var(--error, #E06B6B)', border: '1px solid rgba(224,107,107,0.25)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > perPage && (
        <div style={{ marginTop: 20 }}>
          <Pagination page={page} total={total} perPage={perPage} onPage={setPage} />
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <Modal title={`Plan #${selected.plan.id} — ${selected.plan.name}`} onClose={() => setSelected(null)}>
          <DetailRow label="User" value={`${selected.plan.user_name} (${selected.plan.user_email})`} />
          <DetailRow label="Servings" value={String(selected.plan.servings)} />
          <DetailRow label="Status" value={selected.plan.status} />
          <DetailRow label="Week Start" value={selected.plan.week_start_date ?? '—'} />
          {selected.plan.preferences_json && (
            <DetailRow label="Preferences" value={JSON.stringify(selected.plan.preferences_json, null, 2)} mono />
          )}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
              Meals ({selected.slots.length} slots)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {selected.slots.map(s => (
                <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
                  <span>{MEAL_ICONS[s.meal_type] ?? '🍴'}</span>
                  <span style={{ color: 'var(--text-secondary)', minWidth: 70 }}>{DAY_NAMES[s.day_index]?.slice(0, 3)} {s.meal_type}</span>
                  <span style={{ color: 'var(--text-primary)', flex: 1 }}>{s.recipe_title ?? s.meal_name ?? '—'}</span>
                  {s.meal_json?.calories_estimate ? (
                    <span style={{ fontSize: 11, color: 'var(--claude-orange)' }}>{s.meal_json.calories_estimate} kcal</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              onClick={() => setConfirm({ msg: `Delete plan "${selected.plan.name}"?`, fn: () => doDelete(selected.plan.id) })}
              style={{ background: 'rgba(224,107,107,0.15)', color: 'var(--error, #E06B6B)', border: '1px solid rgba(224,107,107,0.3)', borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}
            >
              Delete Plan
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}