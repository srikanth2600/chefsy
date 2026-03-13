'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChefTheme } from '@/components/chef/ChefThemeContext';
import { Btn, SLabel, Card, Input, Pill, ThemeToggle, fmtN } from '@/components/chef/ui';
import type { Recipe, RecipeIngredient } from '@/components/chef/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

// ─── Upload / Edit Form ───────────────────────────────────────────────────────
function RecipeForm({ onClose, initial }: { onClose: () => void; initial?: Partial<Recipe> }) {
  const { t } = useChefTheme();
  const [title, setTitle] = useState(initial?.title || '');
  const [cuisine, setCuisine] = useState(initial?.cuisine || '');
  const [difficulty, setDifficulty] = useState(initial?.difficulty || 'Moderate');
  const [cookTime, setCookTime] = useState(initial?.cook_time || '');
  const [servings, setServings] = useState<number>(initial?.servings || 4);
  const [desc, setDesc] = useState(initial?.description || '');
  const [ytUrl, setYtUrl] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initial?.ingredients || [{ name: '', quantity: '', unit: 'g' }, { name: '', quantity: '', unit: 'g' }]
  );
  const [steps, setSteps] = useState<string[]>(initial?.steps || ['', '']);
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const fi: React.CSSProperties = { width: '100%', padding: '8px 11px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

  const handleSave = async () => {
    setSaving(true);
    // API: POST /chef/recipes  body: FormData
    await new Promise((r) => setTimeout(r, 800)); // mock
    setSaving(false);
    setDone(true);
  };

  if (done) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 24, background: t.bg }}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: t.textPrimary, fontFamily: 'Georgia, serif', margin: 0 }}>{published ? 'Recipe Published!' : 'Recipe Saved as Draft!'}</h2>
        <p style={{ fontSize: 13, color: t.textSecondary, textAlign: 'center', maxWidth: 320 }}>
          {published ? 'Viewers can now like, dislike, comment and share your recipe.' : 'You can publish it anytime from your recipes list.'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" t={t} onClick={() => setDone(false)}>Add Another</Btn>
          <Btn t={t} onClick={onClose}>← Back to Recipes</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: t.bg }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 18px 80px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>←</button>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: t.textPrimary, margin: 0 }}>{initial?.id ? 'Edit Recipe' : 'New Recipe'}</h1>
        </div>

        {/* Basic Info */}
        <Card t={t} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 14px' }}>📋 Basic Info</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <SLabel t={t}>Recipe Name *</SLabel>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Authentic Chicken Biryani" style={fi} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <SLabel t={t}>Cuisine</SLabel>
                <input value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Hyderabadi" style={fi} />
              </div>
              <div>
                <SLabel t={t}>Difficulty</SLabel>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ ...fi, padding: '8px 10px' }}>
                  {['Easy', 'Moderate', 'Hard', 'Expert'].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <SLabel t={t}>Cook Time</SLabel>
                <input value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="e.g. 45 min" style={fi} />
              </div>
              <div>
                <SLabel t={t}>Servings</SLabel>
                <input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} placeholder="4" style={fi} />
              </div>
            </div>
          </div>
        </Card>

        {/* Photo Upload */}
        <Card t={t} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 10px' }}>📸 Recipe Photo</p>
          <div
            style={{ border: `2px dashed ${t.border}`, borderRadius: 12, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 8, color: t.textTertiary, fontSize: 13, transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.borderAcc)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
          >
            <span style={{ opacity: 0.5, fontSize: 22 }}>📸</span> Tap to upload photo
          </div>
        </Card>

        {/* YouTube Link */}
        <Card t={t} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 5px' }}>🎬 YouTube Video <span style={{ fontSize: 10, color: t.textTertiary, fontWeight: 400 }}>(optional)</span></p>
          <p style={{ fontSize: 11, color: t.textTertiary, margin: '0 0 10px' }}>Linked videos appear in your Reels tab and Find a Chef search results.</p>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 13 }}>▶</span>
            <input value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" style={{ ...fi, paddingLeft: 30 }} />
          </div>
          {ytUrl && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: t.bgSurface, borderRadius: 10, border: `1px solid ${t.borderAcc}`, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>✅</span>
              <p style={{ fontSize: 12, color: t.textPrimary, margin: 0, fontWeight: 600 }}>YouTube video linked!</p>
            </div>
          )}
        </Card>

        {/* Description */}
        <Card t={t} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 5px' }}>📝 Description</p>
          <p style={{ fontSize: 11, color: t.textTertiary, margin: '0 0 10px' }}>Describe your recipe — key techniques, story, tips and variations.</p>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="This biryani recipe has been passed down through three generations…"
            rows={4}
            style={{ ...fi, resize: 'vertical', lineHeight: 1.7 }}
          />
        </Card>

        {/* Ingredients */}
        <Card t={t} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 12px' }}>🥕 Ingredients</p>
          {ingredients.map((ing, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 28px', gap: 6, marginBottom: 7, alignItems: 'center' }}>
              <input value={ing.name} onChange={(e) => setIngredients((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Ingredient" style={fi} />
              <input value={ing.quantity} onChange={(e) => setIngredients((p) => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} placeholder="Qty" style={fi} />
              <select value={ing.unit} onChange={(e) => setIngredients((p) => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} style={{ ...fi, padding: '7px 5px' }}>
                {['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'piece', 'pinch'].map((u) => <option key={u}>{u}</option>)}
              </select>
              <button
                onClick={() => ingredients.length > 1 && setIngredients((p) => p.filter((_, j) => j !== i))}
                style={{ width: 28, height: 34, borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.error, cursor: ingredients.length > 1 ? 'pointer' : 'not-allowed', fontSize: 12, opacity: ingredients.length > 1 ? 1 : 0.3, fontFamily: 'inherit' }}
              >✕</button>
            </div>
          ))}
          <button onClick={() => setIngredients((p) => [...p, { name: '', quantity: '', unit: 'g' }])} style={{ padding: '5px 12px', borderRadius: 9, border: `1px dashed ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Ingredient</button>
        </Card>

        {/* Steps */}
        <Card t={t} style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 12px' }}>👨‍🍳 Cooking Steps</p>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: t.accentBg, border: `1px solid ${t.borderAcc}`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 6 }}>{i + 1}</div>
              <textarea
                value={step}
                onChange={(e) => setSteps((p) => p.map((x, j) => j === i ? e.target.value : x))}
                placeholder={`Step ${i + 1}…`}
                rows={2}
                style={{ ...fi, flex: 1, resize: 'vertical' }}
              />
              <button
                onClick={() => steps.length > 1 && setSteps((p) => p.filter((_, j) => j !== i))}
                style={{ width: 28, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.error, cursor: steps.length > 1 ? 'pointer' : 'not-allowed', fontSize: 12, marginTop: 5, opacity: steps.length > 1 ? 1 : 0.3, fontFamily: 'inherit' }}
              >✕</button>
            </div>
          ))}
          <button onClick={() => setSteps((p) => [...p, ''])} style={{ padding: '5px 12px', borderRadius: 9, border: `1px dashed ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Step</button>
        </Card>

        {/* Nutrition */}
        <Card t={t} style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 12px' }}>🥗 Nutrition <span style={{ fontSize: 10, color: t.textTertiary, fontWeight: 400 }}>(optional)</span></p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[['🔥 Calories', calories, setCalories], ['💪 Protein (g)', protein, setProtein], ['🌾 Carbs (g)', carbs, setCarbs], ['🥑 Fat (g)', fat, setFat]].map(([label, val, setter]) => (
              <div key={String(label)}>
                <SLabel t={t}>{String(label)}</SLabel>
                <input type="number" min={0} value={String(val)} onChange={(e) => (setter as (v: string) => void)(e.target.value)} placeholder="0" style={fi} />
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn variant="ghost" t={t} onClick={onClose}>Cancel</Btn>
          <Btn variant="ghost" t={t} onClick={() => { setPublished(false); handleSave(); }}>Save as Draft</Btn>
          <Btn t={t} onClick={() => { setPublished(true); handleSave(); }} style={{ minWidth: 140 }}>
            {saving ? 'Publishing…' : '🍳 Publish Recipe'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Recipes List ─────────────────────────────────────────────────────────────
function RecipesList({ onNew, onEdit }: { onNew: () => void; onEdit: (r: Partial<Recipe>) => void }) {
  const { t } = useChefTheme();
  const router = useRouter();
  const isPro = false; // replace with real plan check

  const mockList = [
    { id: 1, title: 'Dum Biryani', cuisine: 'Hyderabadi', difficulty: 'Hard', views: 2840, likes: 521, published: true, created: '2 days ago' },
    { id: 2, title: 'Haleem', cuisine: 'Hyderabadi', difficulty: 'Hard', views: 1240, likes: 188, published: true, created: '1 week ago' },
    { id: 3, title: 'Mirchi ka Salan', cuisine: 'Hyderabadi', difficulty: 'Moderate', views: 680, likes: 94, published: false, created: '2 weeks ago' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: t.bg, padding: '20px 18px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.push('/chef-dashboard')} style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>←</button>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: t.textPrimary, margin: 0 }}>My Recipes</h1>
              <p style={{ fontSize: 11, color: t.textTertiary, margin: 0 }}>{mockList.length} recipes · {mockList.filter((r) => r.published).length} live</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ThemeToggle />
            <Btn t={t} onClick={onNew}>+ New Recipe</Btn>
          </div>
        </div>

        {/* Plan bar */}
        {!isPro && (
          <div style={{ background: t.bgCard, border: `1px solid ${t.borderAcc}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: t.textSecondary, flex: 1 }}>Free plan: {mockList.length}/3 recipes used</span>
            <Btn t={t} size="sm">✦ Upgrade for unlimited</Btn>
          </div>
        )}

        {/* YouTube Video Link */}
        <Card t={t} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 8px' }}>🎬 Link YouTube Video</p>
          <p style={{ fontSize: 11, color: t.textTertiary, margin: '0 0 10px' }}>Link a YouTube video to appear in your Reels tab and Find a Chef search.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>▶</span>
              <input placeholder="https://youtube.com/watch?v=…" style={{ width: '100%', padding: '8px 11px 8px 28px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <Btn variant="ghost" size="sm" t={t}>Add</Btn>
          </div>
        </Card>

        {/* Recipes */}
        {mockList.map((r) => (
          <div
            key={r.id}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 13, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9, transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.borderAcc)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: t.bgSurface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, opacity: 0.4, flexShrink: 0 }}>🍳</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: t.textTertiary, flexWrap: 'wrap' }}>
                <span>{r.cuisine}</span>
                <Pill t={t} accent small>{r.difficulty}</Pill>
                <span>👁 {fmtN(r.views)}</span>
                <span>♥ {r.likes}</span>
                <span>{r.created}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 9, padding: '2px 9px', borderRadius: 99, fontWeight: 600, background: r.published ? 'rgba(92,184,126,0.12)' : t.bgSurface, color: r.published ? t.success : t.textTertiary, border: `1px solid ${r.published ? 'rgba(92,184,126,0.25)' : t.border}` }}>
                {r.published ? '● Live' : '○ Draft'}
              </span>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => onEdit(r as unknown as Partial<Recipe>)} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                <button style={{ fontSize: 10, padding: '3px 9px', borderRadius: 7, border: `1px solid ${t.error}22`, background: 'transparent', color: t.error, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recipes Page ─────────────────────────────────────────────────────────────
function RecipesPage() {
  const [mode, setMode] = useState<'list' | 'new' | 'edit'>('list');
  const [editing, setEditing] = useState<Partial<Recipe> | undefined>(undefined);

  const handleEdit = (r: Partial<Recipe>) => { setEditing(r); setMode('edit'); };

  if (mode === 'new' || mode === 'edit') {
    return <RecipeForm initial={mode === 'edit' ? editing : undefined} onClose={() => { setMode('list'); setEditing(undefined); }} />;
  }
  return <RecipesList onNew={() => setMode('new')} onEdit={handleEdit} />;
}

export default function RecipesWrapper() {
  return <RecipesPage />;
}
