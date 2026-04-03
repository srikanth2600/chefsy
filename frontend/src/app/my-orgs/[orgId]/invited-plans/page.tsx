'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const DAY_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_TYPES = ['early_morning', 'breakfast', 'mid_breakfast', 'lunch', 'evening_snack', 'dinner', 'bedtime', 'pre_workout', 'post_workout'];
const MEAL_ICONS: Record<string, string> = {
  early_morning: '🌄', breakfast: '🌅', mid_breakfast: '🍎',
  lunch: '☀️', evening_snack: '🌤', dinner: '🌙',
  bedtime: '😴', pre_workout: '⚡', post_workout: '💪',
};
const MEAL_LABEL: Record<string, string> = {
  early_morning: 'Early Morning', breakfast: 'Breakfast', mid_breakfast: 'Mid Morning',
  lunch: 'Lunch', evening_snack: 'Evening Snack', dinner: 'Dinner',
  bedtime: 'Bedtime', pre_workout: 'Pre-Workout', post_workout: 'Post-Workout',
};

function encodePlanId(id: number): string {
  try { return btoa(`chefsy:${id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); }
  catch { return String(id); }
}

interface Invite {
  id: number;
  status: 'pending' | 'adopted' | 'declined';
  invited_at: string;
  responded_at?: string;
  adopted_plan_id?: number;
  plan_name: string;
  description?: string;
  week_start_date?: string;
  meal_types: string[];
  target_prefs?: Record<string, unknown>;
  group_name?: string;
  template_plan_id: number;
}

interface Slot {
  day_index: number;
  meal_type: string;
  meal_name?: string;
  recipe_title?: string;
}

const STATUS_STYLE = {
  pending:  { bg: 'rgba(234,179,8,0.12)',   color: '#b45309',  label: 'Pending'  },
  adopted:  { bg: 'rgba(34,197,94,0.1)',    color: '#16a34a',  label: 'Adopted'  },
  declined: { bg: 'rgba(239,68,68,0.08)',   color: '#b91c1c',  label: 'Declined' },
};

function PlanPreviewGrid({ planId }: { planId: number }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/org/me/custom-meal-planner/${planId}`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.slots) setSlots(d.slots); })
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading) return <div style={{ color: '#94a3b8', fontSize: 12, padding: 8 }}>Loading preview…</div>;

  const mealTypesPresent = MEAL_TYPES.filter(mt => slots.some(s => s.meal_type === mt));

  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11, minWidth: 560 }}>
        <thead>
          <tr>
            <th style={{ padding: '6px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>Meal</th>
            {DAY_SHORT.map(d => (
              <th key={d} style={{ padding: '6px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', textAlign: 'center' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mealTypesPresent.map(mt => (
            <tr key={mt}>
              <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                {MEAL_ICONS[mt]} {MEAL_LABEL[mt]}
              </td>
              {[0, 1, 2, 3, 4, 5, 6].map(di => {
                const slot = slots.find(s => s.day_index === di && s.meal_type === mt);
                return (
                  <td key={di} style={{ padding: '5px 6px', border: '1px solid #e2e8f0', textAlign: 'center', color: '#475569', background: slot ? '#fff' : '#fafafa' }}>
                    {slot ? (slot.meal_name || slot.recipe_title || '—') : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InviteCard({ invite, orgId, onResponse }: { invite: Invite; orgId: number; onResponse: () => void }) {
  const [showPreview, setShowPreview] = useState(false);
  const [acting, setActing] = useState<'adopt' | 'decline' | null>(null);
  const [message, setMessage] = useState('');

  const doAction = async (action: 'adopt' | 'decline') => {
    setActing(action);
    setMessage('');
    try {
      const r = await fetch(`${API}/org/member/my-orgs/${orgId}/invited-plans/${invite.id}/${action}`, {
        method: 'POST', headers: { Authorization: `Bearer ${tok()}` },
      });
      const d = await r.json();
      if (r.ok) {
        setMessage(action === 'adopt' ? d.message || 'Plan added to your Meal Plans!' : 'Invite declined.');
        onResponse();
      } else {
        setMessage(d.detail || 'Something went wrong.');
      }
    } catch { setMessage('Network error.'); }
    finally { setActing(null); }
  };

  const ss = STATUS_STYLE[invite.status];

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      padding: 20, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            🥗 {invite.plan_name}
          </div>
          {invite.description && (
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{invite.description}</div>
          )}
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
            {invite.week_start_date && <span>📅 Week of {invite.week_start_date}</span>}
            {invite.group_name && <span>👥 Via group: {invite.group_name}</span>}
            <span>📨 Invited {new Date(invite.invited_at).toLocaleDateString('en-IN')}</span>
          </div>
        </div>
        <span style={{
          padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: ss.bg, color: ss.color, flexShrink: 0,
        }}>
          {ss.label}
        </span>
      </div>

      {/* Adopted plan link */}
      {invite.status === 'adopted' && invite.adopted_plan_id && (
        <div style={{ marginTop: 12 }}>
          <Link
            href={`/meal-plans/${encodePlanId(invite.adopted_plan_id)}`}
            style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}
          >
            View your adopted plan →
          </Link>
        </div>
      )}

      {/* Pending actions */}
      {invite.status === 'pending' && (
        <div style={{ marginTop: 14 }}>
          {message && (
            <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 10, fontWeight: 600 }}>{message}</div>
          )}

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(v => !v)}
            style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, fontWeight: 600 }}
          >
            {showPreview ? '▲ Hide plan preview' : '▼ View 7-day plan preview'}
          </button>

          {showPreview && <PlanPreviewGrid planId={invite.template_plan_id} />}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={() => doAction('adopt')}
              disabled={acting !== null}
              style={{
                flex: 1, background: '#22c55e', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600,
                cursor: acting ? 'wait' : 'pointer', opacity: acting === 'adopt' ? 0.7 : 1,
              }}
            >
              {acting === 'adopt' ? 'Adopting…' : 'Adopt this Plan'}
            </button>
            <button
              onClick={() => doAction('decline')}
              disabled={acting !== null}
              style={{
                flex: 0, padding: '10px 18px', borderRadius: 8,
                border: '1px solid #e2e8f0', background: '#fff',
                color: '#64748b', fontSize: 13, cursor: acting ? 'wait' : 'pointer',
                fontWeight: 600, opacity: acting === 'decline' ? 0.7 : 1,
              }}
            >
              {acting === 'decline' ? '…' : 'Decline'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvitedPlansPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const oid = parseInt(orgId, 10);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState<'all' | 'pending' | 'adopted' | 'declined'>('all');

  const load = () => {
    setLoading(true);
    const qs = filter !== 'all' ? `?status=${filter}` : '';
    fetch(`${API}/org/member/my-orgs/${oid}/invited-plans${qs}`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => setInvites(Array.isArray(d) ? d : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 20px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href={`/my-orgs`} style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none' }}>← My Organisations</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '10px 0 4px' }}>Invited Meal Plans</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          Meal plans shared with you by your organisation. Adopt a plan to add it to your personal meal planner.
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
        {(['all', 'pending', 'adopted', 'declined'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px', borderRadius: '8px 8px 0 0', border: 'none', fontSize: 13,
              cursor: 'pointer', fontWeight: filter === f ? 700 : 400,
              background: filter === f ? '#3b82f6' : 'transparent',
              color: filter === f ? '#fff' : '#64748b',
              textTransform: 'capitalize', transition: 'background 0.15s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '14px 16px', color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 12, background: '#e2e8f0' }} />
          ))}
        </div>
      )}

      {/* List */}
      {!loading && !error && (
        invites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>No invites yet</div>
            <div style={{ fontSize: 13 }}>Your organisation hasn&apos;t shared any meal plans with you yet.</div>
          </div>
        ) : (
          invites.map(inv => (
            <InviteCard key={inv.id} invite={inv} orgId={oid} onResponse={load} />
          ))
        )
      )}
    </div>
  );
}
