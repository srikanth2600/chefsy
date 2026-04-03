'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const DAY_NAMES  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
const MEAL_BG: Record<string, string> = {
  early_morning: 'rgba(251,191,36,0.08)', breakfast: 'rgba(251,191,36,0.12)',
  mid_breakfast: 'rgba(252,211,77,0.08)', lunch: 'rgba(59,130,246,0.08)',
  evening_snack: 'rgba(16,185,129,0.08)', dinner: 'rgba(139,92,246,0.1)',
  bedtime: 'rgba(99,102,241,0.08)', pre_workout: 'rgba(239,68,68,0.07)',
  post_workout: 'rgba(236,72,153,0.07)',
};

interface Slot {
  id?: number;
  day_index: number;
  meal_type: string;
  meal_name?: string;
  recipe_id?: number;
  recipe_title?: string;
  meal_json?: Record<string, unknown>;
  sort_order?: number;
}

interface TemplatePlan {
  id: number;
  name: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  week_start_date?: string;
  meal_types: string[];
  target_prefs?: Record<string, unknown>;
  created_by_name?: string;
  slots: Slot[];
}

interface Invite {
  id: number;
  full_name?: string;
  email: string;
  status: 'pending' | 'adopted' | 'declined';
  group_name?: string;
  invited_at: string;
}

interface Member {
  id: number;
  full_name?: string;
  email: string;
  status: string;
}

interface Group {
  id: number;
  name: string;
  group_type: string;
}

interface RecipeResult {
  id: number;
  title: string;
  recipe_key: string;
}

export default function PlanEditorPage() {
  const router = useRouter();
  const { planId } = useParams<{ planId: string }>();
  const id = parseInt(planId, 10);

  const [plan, setPlan]     = useState<TemplatePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');
  const [error,   setError]   = useState('');

  // Slot editor state
  const [editCell, setEditCell] = useState<{ dayIndex: number; mealType: string } | null>(null);
  const [cellForm, setCellForm] = useState({ meal_name: '', recipe_id: 0, recipe_query: '' });
  const [recipeResults, setRecipeResults] = useState<RecipeResult[]>([]);
  const [recipeSearching, setRecipeSearching] = useState(false);
  const recipeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Assign panel state
  const [showAssign, setShowAssign]   = useState(false);
  const [assignTab,  setAssignTab]    = useState<'members' | 'groups'>('members');
  const [members,    setMembers]      = useState<Member[]>([]);
  const [groups,     setGroups]       = useState<Group[]>([]);
  const [invites,    setInvites]      = useState<Invite[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [selectedGroup,   setSelectedGroup]   = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Plan name inline editing
  const [editingName, setEditingName] = useState(false);
  const [nameVal,     setNameVal]     = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // ── Load plan ──────────────────────────────────────────────────────────────

  const loadPlan = useCallback(() => {
    fetch(`${API}/org/me/custom-meal-planner/${id}`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { setPlan(d); setNameVal(d.name); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ── Slot helpers ───────────────────────────────────────────────────────────

  const getSlot = (dayIndex: number, mealType: string): Slot | undefined =>
    plan?.slots.find(s => s.day_index === dayIndex && s.meal_type === mealType);

  const openCell = (dayIndex: number, mealType: string) => {
    const existing = getSlot(dayIndex, mealType);
    setCellForm({
      meal_name: existing?.meal_name || '',
      recipe_id: existing?.recipe_id || 0,
      recipe_query: existing?.recipe_title || existing?.meal_name || '',
    });
    setRecipeResults([]);
    setEditCell({ dayIndex, mealType });
  };

  const saveSlot = async () => {
    if (!plan || !editCell) return;
    if (!cellForm.meal_name.trim() && !cellForm.recipe_id) {
      showToast('Enter a meal name or pick a recipe.');
      return;
    }
    setSaving(true);
    try {
      const body: Slot = {
        day_index: editCell.dayIndex,
        meal_type: editCell.mealType,
        meal_name: cellForm.meal_name.trim() || undefined,
        recipe_id: cellForm.recipe_id || undefined,
      };
      const r = await fetch(`${API}/org/me/custom-meal-planner/${id}/slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Save failed'); }
      const saved = await r.json();
      setPlan(prev => {
        if (!prev) return prev;
        const slots = prev.slots.filter(s => !(s.day_index === editCell.dayIndex && s.meal_type === editCell.mealType));
        return { ...prev, slots: [...slots, saved] };
      });
      setEditCell(null);
    } catch (e: any) { showToast(e.message); }
    finally { setSaving(false); }
  };

  const clearSlot = async (slotId: number, dayIndex: number, mealType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await fetch(`${API}/org/me/custom-meal-planner/${id}/slots/${slotId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` },
    });
    if (r.ok) {
      setPlan(prev => prev ? { ...prev, slots: prev.slots.filter(s => !(s.day_index === dayIndex && s.meal_type === mealType)) } : prev);
    }
  };

  // ── Recipe search (debounced) ──────────────────────────────────────────────

  const searchRecipes = (query: string) => {
    setCellForm(f => ({ ...f, recipe_query: query }));
    if (recipeTimer.current) clearTimeout(recipeTimer.current);
    if (!query.trim()) { setRecipeResults([]); return; }
    recipeTimer.current = setTimeout(async () => {
      setRecipeSearching(true);
      try {
        const r = await fetch(`${API}/recipes?q=${encodeURIComponent(query)}&limit=8`, { headers: { Authorization: `Bearer ${tok()}` } });
        if (r.ok) { const d = await r.json(); setRecipeResults(d.results || d || []); }
      } catch {}
      finally { setRecipeSearching(false); }
    }, 400);
  };

  // ── Publish plan ───────────────────────────────────────────────────────────

  const publishPlan = async () => {
    const r = await fetch(`${API}/org/me/custom-meal-planner/${id}/publish`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok()}` },
    });
    if (r.ok) {
      setPlan(prev => prev ? { ...prev, status: 'published' } : prev);
      showToast('Plan published!');
      loadInvites();
      setShowAssign(true);
    } else {
      const d = await r.json();
      showToast(d.detail || 'Could not publish.');
    }
  };

  // ── Name update ────────────────────────────────────────────────────────────

  const saveName = async () => {
    if (!nameVal.trim() || nameVal === plan?.name) { setEditingName(false); return; }
    const r = await fetch(`${API}/org/me/custom-meal-planner/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
      body: JSON.stringify({ name: nameVal.trim() }),
    });
    if (r.ok) { setPlan(prev => prev ? { ...prev, name: nameVal.trim() } : prev); }
    setEditingName(false);
  };

  // ── Assign panel ───────────────────────────────────────────────────────────

  const loadInvites = () => {
    fetch(`${API}/org/me/custom-meal-planner/${id}/invites`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => setInvites(Array.isArray(d) ? d : []));
  };

  const loadMembers = () => {
    fetch(`${API}/org/me/members?limit=200`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : { members: [] })
      .then(d => setMembers(Array.isArray(d) ? d : (d.members || [])));
  };

  const loadGroups = () => {
    fetch(`${API}/org/me/groups`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => setGroups(Array.isArray(d) ? d : []));
  };

  useEffect(() => {
    if (showAssign) { loadInvites(); loadMembers(); loadGroups(); }
  }, [showAssign]);

  const assignMembers = async () => {
    if (!selectedMembers.length) { showToast('Select at least one member.'); return; }
    setAssigning(true);
    try {
      const r = await fetch(`${API}/org/me/custom-meal-planner/${id}/assign/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ member_ids: selectedMembers }),
      });
      const d = await r.json();
      showToast(r.ok ? d.detail : (d.detail || 'Failed'));
      if (r.ok) { setSelectedMembers([]); loadInvites(); }
    } finally { setAssigning(false); }
  };

  const assignGroup = async () => {
    if (!selectedGroup) { showToast('Select a group.'); return; }
    setAssigning(true);
    try {
      const r = await fetch(`${API}/org/me/custom-meal-planner/${id}/assign/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ group_id: selectedGroup }),
      });
      const d = await r.json();
      showToast(r.ok ? d.detail : (d.detail || 'Failed'));
      if (r.ok) { setSelectedGroup(null); loadInvites(); }
    } finally { setAssigning(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ color: '#64748b', padding: 40 }}>Loading plan…</div>;
  if (error || !plan) return (
    <div style={{ color: '#b91c1c', padding: 40 }}>
      {error || 'Plan not found.'}
      <br /><button onClick={() => router.push('/org-dashboard/meal-planner')} style={{ marginTop: 12, fontSize: 13, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
    </div>
  );

  const activeMealTypes = (plan.meal_types || ['breakfast', 'lunch', 'dinner']).filter(mt => MEAL_TYPES.includes(mt));

  return (
    <div>
      {/* Toast */}
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/org-dashboard/meal-planner')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#64748b', padding: '2px 0' }}>←</button>

        <div style={{ flex: 1 }}>
          {editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', border: '1px solid #3b82f6', borderRadius: 6, padding: '2px 8px', outline: 'none' }}
            />
          ) : (
            <h1
              style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, cursor: 'text' }}
              onClick={() => plan.status === 'draft' && setEditingName(true)}
              title={plan.status === 'draft' ? 'Click to edit name' : ''}
            >
              {plan.name}
            </h1>
          )}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: plan.status === 'draft' ? 'rgba(234,179,8,0.12)' : plan.status === 'published' ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.15)',
              color: plan.status === 'draft' ? '#b45309' : plan.status === 'published' ? '#16a34a' : '#6b7280',
              textTransform: 'capitalize',
            }}>
              {plan.status}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{plan.slots.length} slots filled</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {plan.status === 'draft' && (
            <button
              onClick={publishPlan}
              style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Publish Plan
            </button>
          )}
          {plan.status === 'published' && (
            <button
              onClick={() => { loadInvites(); setShowAssign(true); }}
              style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Assign to Members
            </button>
          )}
        </div>
      </div>

      {/* Info bar */}
      {plan.status === 'draft' && (
        <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 20 }}>
          Click any cell to add a meal. Publish when the plan is complete to start assigning it to members.
        </div>
      )}

      {/* 7-day grid */}
      <div style={{ overflowX: 'auto', marginBottom: 32 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780, fontSize: 12 }}>
          <colgroup>
            <col style={{ width: 110 }} />
            {DAY_NAMES.map(d => <col key={d} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, color: '#64748b', textAlign: 'left', fontSize: 11 }}>
                Meal / Day
              </th>
              {DAY_SHORT.map((d, i) => (
                <th key={d} style={{ padding: '8px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 600, color: '#334155', textAlign: 'center', fontSize: 12 }}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeMealTypes.map(mealType => (
              <tr key={mealType}>
                {/* Meal label */}
                <td style={{ padding: '8px 10px', background: MEAL_BG[mealType] || '#fafafa', border: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span>{MEAL_ICONS[mealType]}</span>
                    <span style={{ fontWeight: 600, color: '#334155', fontSize: 11 }}>{MEAL_LABEL[mealType]}</span>
                  </div>
                </td>
                {/* Day cells */}
                {DAY_NAMES.map((_, dayIndex) => {
                  const slot = getSlot(dayIndex, mealType);
                  const isEditable = plan.status === 'draft';
                  return (
                    <td
                      key={dayIndex}
                      onClick={() => isEditable && openCell(dayIndex, mealType)}
                      style={{
                        border: '1px solid #e2e8f0', padding: '6px 6px', verticalAlign: 'top',
                        background: slot ? '#fff' : (isEditable ? '#fafafa' : '#f8fafc'),
                        cursor: isEditable ? 'pointer' : 'default',
                        transition: 'background 0.1s',
                        minWidth: 90,
                      }}
                      onMouseEnter={e => { if (isEditable) (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = slot ? '#fff' : (isEditable ? '#fafafa' : '#f8fafc'); }}
                    >
                      {slot ? (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', lineHeight: 1.3, marginBottom: 3 }}>
                            {slot.meal_name || slot.recipe_title || '—'}
                          </div>
                          {slot.recipe_id && (
                            <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 500 }}>📖 Recipe linked</div>
                          )}
                          {isEditable && slot.id && (
                            <button
                              onClick={e => clearSlot(slot.id!, dayIndex, mealType, e)}
                              style={{ marginTop: 4, fontSize: 10, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              title="Clear slot"
                            >
                              ✕ clear
                            </button>
                          )}
                        </div>
                      ) : (
                        isEditable ? (
                          <div style={{ color: '#cbd5e1', fontSize: 10, textAlign: 'center', padding: '4px 0' }}>+ add</div>
                        ) : null
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cell editor modal */}
      {editCell && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 400, boxShadow: '0 12px 48px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              {MEAL_ICONS[editCell.mealType]} {MEAL_LABEL[editCell.mealType]} — {DAY_NAMES[editCell.dayIndex]}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Enter a meal name or search for a recipe</div>

            {/* Meal name */}
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Meal Name</label>
            <input
              autoFocus
              style={{ display: 'block', width: '100%', marginTop: 4, marginBottom: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              placeholder="e.g. Oats with almond milk"
              value={cellForm.meal_name}
              onChange={e => setCellForm(f => ({ ...f, meal_name: e.target.value }))}
            />

            {/* Recipe search */}
            <label style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Or Pick a Recipe</label>
            <input
              style={{ display: 'block', width: '100%', marginTop: 4, marginBottom: 6, padding: '9px 12px', borderRadius: 8, border: `1px solid ${cellForm.recipe_id ? '#3b82f6' : '#e2e8f0'}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              placeholder="Search recipes…"
              value={cellForm.recipe_query}
              onChange={e => { searchRecipes(e.target.value); if (!e.target.value) setCellForm(f => ({ ...f, recipe_id: 0 })); }}
            />
            {cellForm.recipe_id > 0 && (
              <div style={{ fontSize: 11, color: '#3b82f6', marginBottom: 8 }}>✓ Recipe selected (ID {cellForm.recipe_id})</div>
            )}
            {recipeSearching && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Searching…</div>}
            {recipeResults.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 160, overflowY: 'auto', marginBottom: 12 }}>
                {recipeResults.map(r => (
                  <div
                    key={r.id}
                    onClick={() => { setCellForm(f => ({ ...f, recipe_id: r.id, recipe_query: r.title, meal_name: f.meal_name || r.title })); setRecipeResults([]); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    {r.title}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={saveSlot}
                disabled={saving}
                style={{ flex: 1, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditCell(null)}
                style={{ flex: 0, padding: '9px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign panel */}
      {showAssign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 9990, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 420, background: '#fff', boxShadow: '-4px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {/* Panel header */}
            <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Assign Plan</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{plan.name}</div>
              </div>
              <button onClick={() => setShowAssign(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 20px' }}>
              {(['members', 'groups'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setAssignTab(t)}
                  style={{
                    padding: '10px 14px', border: 'none', borderBottom: assignTab === t ? '2px solid #3b82f6' : '2px solid transparent',
                    background: 'none', fontSize: 13, cursor: 'pointer', fontWeight: assignTab === t ? 700 : 400,
                    color: assignTab === t ? '#3b82f6' : '#64748b', textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
              {assignTab === 'members' ? (
                <>
                  <input
                    style={{ display: 'block', width: '100%', marginBottom: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    placeholder="Search members…"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                  />
                  <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 14 }}>
                    {members
                      .filter(m => !memberSearch || (m.full_name || m.email).toLowerCase().includes(memberSearch.toLowerCase()))
                      .map(m => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(m.id)}
                            onChange={() => setSelectedMembers(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                            style={{ width: 14, height: 14, accentColor: '#3b82f6' }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{m.full_name || m.email}</div>
                            {m.full_name && <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.email}</div>}
                          </div>
                        </label>
                      ))}
                  </div>
                  <button
                    onClick={assignMembers}
                    disabled={assigning || selectedMembers.length === 0}
                    style={{
                      width: '100%', background: '#3b82f6', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600,
                      cursor: assigning || selectedMembers.length === 0 ? 'not-allowed' : 'pointer',
                      opacity: selectedMembers.length === 0 ? 0.5 : 1,
                    }}
                  >
                    {assigning ? 'Sending…' : `Send Invites (${selectedMembers.length} selected)`}
                  </button>
                </>
              ) : (
                <>
                  <select
                    style={{ display: 'block', width: '100%', marginBottom: 14, padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    value={selectedGroup || ''}
                    onChange={e => setSelectedGroup(Number(e.target.value) || null)}
                  >
                    <option value="">Select a group…</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button
                    onClick={assignGroup}
                    disabled={assigning || !selectedGroup}
                    style={{
                      width: '100%', background: '#3b82f6', color: '#fff', border: 'none',
                      borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600,
                      cursor: assigning || !selectedGroup ? 'not-allowed' : 'pointer',
                      opacity: !selectedGroup ? 0.5 : 1,
                    }}
                  >
                    {assigning ? 'Sending…' : 'Send to Group'}
                  </button>
                </>
              )}
            </div>

            {/* Invite list */}
            <div style={{ borderTop: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                Invites sent ({invites.length})
              </div>
              {invites.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No invites sent yet.</div>
              ) : (
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {invites.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{inv.full_name || inv.email}</div>
                        {inv.group_name && <div style={{ color: '#94a3b8', fontSize: 11 }}>via {inv.group_name}</div>}
                      </div>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: inv.status === 'adopted' ? 'rgba(34,197,94,0.1)' : inv.status === 'declined' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                        color: inv.status === 'adopted' ? '#16a34a' : inv.status === 'declined' ? '#b91c1c' : '#b45309',
                      }}>
                        {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
