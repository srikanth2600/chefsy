'use client';
/**
 * Recipes  /adminpanel/recipes
 * APIs:
 *   GET    /admin/recipes?q=&cuisine=&recipe_type=ai|chef|draft&page=&per_page=
 *   POST   /admin/recipes/:id/delete
 *   POST   /admin/recipes/:id/feature
 *   POST   /admin/recipes/:id/toggle-active
 *   GET    /admin/recipes/:id    → full detail
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, ConfirmDialog, Pagination, DetailRow } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type RecipeType = 'all' | 'ai' | 'chef' | 'draft';

type Recipe = {
  id: number; recipe_key: string; title: string; cuisine?: string;
  difficulty?: string; estimated_time?: string; servings?: number;
  likes?: number; dislikes?: number; is_featured?: boolean;
  is_active?: boolean; is_published?: boolean;
  cached?: boolean; created_at?: string; tags?: string[];
  recipe_json?: Record<string, any>;
  owner_name?: string | null;
  generated_by?: string | null;
};

const CUISINES = ['', 'Indian', 'Italian', 'Chinese', 'Mexican', 'Mediterranean', 'American', 'Thai', 'Japanese'];

const TABS: { id: RecipeType; label: string; icon: string; desc: string }[] = [
  { id: 'all',   label: 'All Recipes',  icon: '🍳', desc: 'Every active recipe' },
  { id: 'ai',    label: 'AI Generated', icon: '🤖', desc: 'Recipes created by AI' },
  { id: 'chef',  label: 'Chef Recipes', icon: '👨‍🍳', desc: 'Uploaded by chefs' },
  { id: 'draft', label: 'Drafts',       icon: '📝', desc: 'Unpublished / inactive' },
];

export default function RecipesPage() {
  const router = useRouter();
  const [tab,      setTab]      = useState<RecipeType>('all');
  const [recipes,  setRecipes]  = useState<Recipe[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [q,        setQ]        = useState('');
  const [cuisine,  setCuisine]  = useState('');
  const [sortOrder, setSortOrder] = useState<'desc'|'asc'>('desc');
  const [sortBy, setSortBy] = useState<'created_at'|'likes'>('created_at');
  const [dateRange, setDateRange] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [rawData,  setRawData]  = useState<{ title: string; text: string } | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const perPage = 15;

  const load = useCallback(async (pg = page, currentTab = tab) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (q)       p.set('q',       q);
      if (cuisine) p.set('cuisine', cuisine);
      if (currentTab !== 'all') p.set('recipe_type', currentTab);
      if (sortOrder) p.set('order', sortOrder);
      if (sortBy)    p.set('sort_by', sortBy);
      if (startDate) p.set('start_date', startDate);
      if (endDate)   p.set('end_date', endDate);
      const r = await fetch(`${API}/admin/recipes?${p}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setRecipes(Array.isArray(j.recipes) ? j.recipes : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, q, cuisine, tab, sortOrder, sortBy, startDate, endDate]); // eslint-disable-line

  useEffect(() => { load(page, tab); }, [page, tab]); // eslint-disable-line

  const doDelete  = async (id: number) => {
    await fetch(`${API}/admin/recipes/${id}/delete`, { method: 'POST', headers: hdr() });
    setSelected(null); load(page, tab);
  };

  const doFeature = async (r: Recipe) => {
    await fetch(`${API}/admin/recipes/${r.id}/feature`, { method: 'POST', headers: hdr() });
    load(page, tab);
  };

  const doToggleActive = async (r: Recipe) => {
    const res = await fetch(`${API}/admin/recipes/${r.id}/toggle-active`, { method: 'POST', headers: hdr() });
    if (res.ok) {
      const j = await res.json();
      setRecipes(prev => prev.map(x => x.id === r.id ? { ...x, is_active: j.is_active } : x));
    }
  };

  const diffColor: Record<string, string> = { Easy: 'green', Medium: 'yellow', Hard: 'red' };

  const fetchDetail = async (id: number) => {
    const r = await fetch(`${API}/admin/recipes/${id}`, { headers: hdr() });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  };

  const switchTab = (t: RecipeType) => {
    setTab(t);
    setPage(1);
    setQ('');
    setCuisine('');
  };

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Recipes</div>
          <div className="adm-ph-sub">Browse and manage all recipes · {total} total</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`adm-btn adm-btn-sm ${tab === t.id ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: tab === t.id ? 700 : 400 }}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      <div className="adm-filters">
        <input className="adm-input" placeholder="Search recipe title…" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1, tab))} />
        <select className="adm-select" value={cuisine} onChange={e => setCuisine(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="">All cuisines</option>
          {CUISINES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="adm-select" value={sortBy} onChange={e => { setSortBy(e.target.value as 'created_at'|'likes'); setPage(1); }} style={{ width: 160 }}>
          <option value="created_at">Sort: Date</option>
          <option value="likes">Sort: Likes</option>
        </select>
        <select className="adm-select" value={dateRange} onChange={e => {
          const v = e.target.value; setDateRange(v); setPage(1);
          const today = new Date();
          let sd = '', ed = '';
          const toISO = (d: Date) => d.toISOString().slice(0,10);
          if (v === 'today') { sd = toISO(today); ed = sd; }
          else if (v === 'yesterday') { const d = new Date(today); d.setDate(today.getDate()-1); sd = toISO(d); ed = sd; }
          else if (v === 'this_week') { const d = new Date(today); d.setDate(d.getDate()-d.getDay()); sd = toISO(d); ed = toISO(today); }
          else if (v === 'last_week') { const d = new Date(today); const diff = d.getDay()+7; d.setDate(d.getDate()-diff); const s2 = new Date(d); const e2 = new Date(d); e2.setDate(s2.getDate()+6); sd = toISO(s2); ed = toISO(e2); }
          else if (v === 'this_month') { sd = toISO(new Date(today.getFullYear(), today.getMonth(), 1)); ed = toISO(today); }
          else if (v === 'last_month') { sd = toISO(new Date(today.getFullYear(), today.getMonth()-1, 1)); ed = toISO(new Date(today.getFullYear(), today.getMonth(), 0)); }
          else { sd = ''; ed = ''; }
          setStartDate(sd); setEndDate(ed);
        }} style={{ width: 180, marginLeft: 8 }}>
          <option value="all">Any time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_week">This week</option>
          <option value="last_week">Last week</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="custom">Custom</option>
        </select>
        {dateRange === 'custom' && (
          <>
            <input type="date" className="adm-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: 150, marginLeft: 8 }} />
            <input type="date" className="adm-input" value={endDate}   onChange={e => setEndDate(e.target.value)}   style={{ width: 150, marginLeft: 8 }} />
          </>
        )}
        <select className="adm-select" value={sortOrder} onChange={e => { setSortOrder(e.target.value as 'asc'|'desc'); setPage(1); }}>
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => { setPage(1); load(1, tab); }}>Search</button>
        {(q || cuisine) && <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setQ(''); setCuisine(''); setPage(1); load(1, tab); }}>Clear</button>}
      </div>

      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Recipe</th>
                <th>Source</th>
                <th>Cuisine</th>
                <th>Difficulty</th>
                <th>Time</th>
                <th>Likes</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(10).fill(0).map((_, i) => (
                <tr key={i}>{Array(9).fill(0).map((_, j) => <td key={j}><div className="adm-sk" style={{ height: 13, width: j === 0 ? 160 : 70 }} /></td>)}</tr>
              )) : recipes.length === 0 ? (
                <tr><td colSpan={9}><div className="adm-empty"><div className="adm-empty-icon">🍳</div><div className="adm-empty-title">No recipes found</div></div></td></tr>
              ) : recipes.map(r => (
                <tr key={r.id} style={{ opacity: r.is_active === false ? 0.55 : 1 }}>
                  <td>
                    <div>
                      <div className="td-bold adm-truncate" style={{ maxWidth: 200 }}>{r.title}</div>
                      <div className="adm-mono" style={{ color: 'var(--at3)', fontSize: 11 }}>{r.recipe_key}</div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {r.owner_name
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span>👨‍🍳</span>{r.owner_name}</span>
                      : r.generated_by
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span>🤖</span>{r.generated_by}</span>
                        : <span style={{ color: 'var(--at3)' }}>AI</span>
                    }
                  </td>
                  <td>{r.cuisine || '—'}</td>
                  <td>{r.difficulty ? <span className={`adm-badge ${diffColor[r.difficulty] || 'gray'}`}>{r.difficulty}</span> : '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.estimated_time || '—'}</td>
                  <td>
                    <span style={{ color: 'var(--ag)', fontWeight: 600, fontSize: 13 }}>↑{r.likes ?? 0}</span>
                    {' '}
                    <span style={{ color: 'var(--ar)', fontWeight: 600, fontSize: 13 }}>↓{r.dislikes ?? 0}</span>
                  </td>
                  <td>
                    {r.is_active === false
                      ? <span className="adm-badge gray">⊘ Inactive</span>
                      : r.is_published === false
                        ? <span className="adm-badge yellow">○ Draft</span>
                        : <span className="adm-badge green">● Live</span>
                    }
                  </td>
                  <td style={{ fontSize: 12 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="adm-row adm-g2">
                      <button className="adm-btn adm-btn-info adm-btn-sm" onClick={async () => {
                        try { const detail = await fetchDetail(r.id); setSelected({ ...r, ...detail, recipe_json: detail.recipe_json }); } catch {}
                      }}>View</button>
                      <button
                        className={`adm-btn adm-btn-sm ${r.is_active === false ? 'adm-btn-primary' : 'adm-btn-warn'}`}
                        title={r.is_active === false ? 'Re-activate this recipe' : 'Deactivate / hide this recipe'}
                        onClick={() => setConfirm({
                          msg: r.is_active === false
                            ? `Re-activate "${r.title}"? It will become visible again.`
                            : `Deactivate "${r.title}"? It will be hidden from users.`,
                          fn: () => { setConfirm(null); doToggleActive(r); },
                        })}>
                        {r.is_active === false ? '✓ Activate' : '⊘ Deactivate'}
                      </button>
                      <button className="adm-btn adm-btn-ghost adm-btn-sm" title="Raw LLM data" onClick={async () => {
                        try {
                          const detail = await fetchDetail(r.id);
                          const raw = detail?.recipe_json?.ai_context?.raw_llm_text || '';
                          setRawData({ title: detail?.title || r.title, text: raw || 'No raw LLM data found.' });
                        } catch { setRawData({ title: r.title, text: 'Failed to load raw data.' }); }
                      }}>🧾 Raw</button>
                      <button className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() => setConfirm({ msg: `Delete "${r.title}"? This cannot be undone.`, fn: () => { setConfirm(null); doDelete(r.id); } })}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} perPage={perPage} onPage={p => { setPage(p); }} />
      </div>

      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          {selected.generated_by && (
            <div style={{ fontSize: 12, color: 'var(--at3)', marginBottom: 8 }}>🤖 LLM: {selected.generated_by}</div>
          )}
          <DetailRow label="Recipe Key"   value={<span className="adm-mono">{selected.recipe_key}</span>} />
          <DetailRow label="Source"       value={selected.owner_name ? `👨‍🍳 ${selected.owner_name}` : '🤖 AI Generated'} />
          <DetailRow label="Cuisine"      value={selected.cuisine} />
          <DetailRow label="Difficulty"   value={selected.difficulty} />
          <DetailRow label="Time"         value={selected.estimated_time} />
          <DetailRow label="Servings"     value={selected.servings} />
          <DetailRow label="Likes"        value={selected.likes} />
          <DetailRow label="Dislikes"     value={selected.dislikes} />
          <DetailRow label="Status"       value={selected.is_active === false ? '⊘ Inactive' : selected.is_published === false ? '○ Draft' : '● Live'} />
          <DetailRow label="Featured"     value={selected.is_featured ? '✅ Yes' : 'No'} />
          <DetailRow label="Tags"         value={selected.tags?.join(', ')} />
          <DetailRow label="Created"      value={selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'} />
          {selected.recipe_json?.description && (
            <div style={{ marginTop: 12 }}>
              <div className="adm-label" style={{ marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13, color: 'var(--at3)' }}>{selected.recipe_json.description}</div>
            </div>
          )}
          {Array.isArray(selected.recipe_json?.ingredients) && selected.recipe_json.ingredients.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="adm-label" style={{ marginBottom: 6 }}>Ingredients</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: 'var(--at3)' }}>
                {selected.recipe_json.ingredients.map((i: any, idx: number) => (
                  <li key={idx}>{i.name}{i.quantity ? ` — ${i.quantity}${i.unit ? ` ${i.unit}` : ''}` : ''}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(selected.recipe_json?.steps) && selected.recipe_json.steps.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="adm-label" style={{ marginBottom: 6 }}>Steps</div>
              <ol style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: 'var(--at3)' }}>
                {selected.recipe_json.steps.map((s: any, idx: number) => (
                  <li key={idx}>{typeof s === 'string' ? s : [s.title, s.description].filter(Boolean).join(': ')}</li>
                ))}
              </ol>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button
              className={`adm-btn adm-btn-sm ${selected.is_active === false ? 'adm-btn-primary' : 'adm-btn-warn'}`}
              onClick={() => setConfirm({
                msg: selected.is_active === false ? `Re-activate "${selected.title}"?` : `Deactivate "${selected.title}"?`,
                fn: () => { setConfirm(null); doToggleActive(selected); setSelected(null); },
              })}>
              {selected.is_active === false ? '✓ Activate Recipe' : '⊘ Deactivate Recipe'}
            </button>
            <button className="adm-btn adm-btn-danger adm-btn-sm"
              onClick={() => setConfirm({ msg: `Delete "${selected.title}"?`, fn: () => { setConfirm(null); doDelete(selected.id); } })}>
              Delete Recipe
            </button>
          </div>
        </Modal>
      )}

      {rawData && (
        <Modal title={`Raw LLM Data — ${rawData.title}`} onClose={() => setRawData(null)}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--at3)', margin: 0 }}>{rawData.text}</pre>
        </Modal>
      )}

      {confirm && <ConfirmDialog title="Confirm Action" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}
