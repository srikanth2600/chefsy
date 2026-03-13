'use client';

/**
 * RecipeMarkdown  —  src/components/RecipeMarkdown.tsx
 * ══════════════════════════════════════════════════════
 *
 * Clean Claude / ChatGPT-style recipe renderer.
 * Works identically whether data comes from:
 *   • DB cache  (flat JSON: title, ingredients[], steps[], meta{}, nutrition{})
 *   • LLM fresh (same shape — your normaliser already standardises both)
 *   • Legacy UI recipe (categories{}, name field, tip string)
 *
 * Data shape handled:
 * ─────────────────────────────────────────────────────
 *  recipe.title  OR  recipe.name
 *  recipe.description
 *  recipe.meta.cuisine  OR  recipe.cuisine
 *  recipe.meta.difficulty  OR  recipe.difficulty
 *  recipe.meta.estimated_time  OR  recipe.estimated_time  OR  recipe.time
 *  recipe.servings
 *  recipe.tags[]
 *  recipe.cached  OR  recipe.from_cache   →  ⚡ Instant badge
 *
 *  INGREDIENTS (two formats, both handled):
 *    Format A — flat array (new):
 *      recipe.ingredients = [{ name, quantity, unit, emoji?, category? }]
 *    Format B — category map (legacy):
 *      recipe.categories = { proteins: [{name, quantity, unit, emoji}], ... }
 *
 *  STEPS (two formats, both handled):
 *    Format A — string array:   recipe.steps = ["Do this", "Then that"]
 *    Format B — object array:   recipe.steps = [{ title, description, time? }]
 *
 *  TIPS:
 *    recipe.tips[]   OR   recipe.tip  (single string)
 *
 *  NUTRITION:
 *    recipe.nutrition  OR  recipe.nutrition_total
 *    { calories, protein, carbs, fat, ... }
 */

import React, { useState, useEffect } from 'react';
import { getIngredientEmoji } from '@/app/ingredientEmojis';

/* ─── Cuisine flag ──────────────────────────────── */
const CUISINE_FLAGS: Record<string, string> = {
  indian: '🇮🇳', italian: '🇮🇹', chinese: '🇨🇳', mexican: '🌮',
  american: '🍔', thai: '🇹🇭', japanese: '🇯🇵', mediterranean: '🫒',
  french: '🇫🇷', korean: '🇰🇷', greek: '🇬🇷', turkish: '🇹🇷',
  spanish: '🇪🇸', lebanese: '🇱🇧', moroccan: '🇲🇦',
};
function getCuisineFlag(c: string) {
  const l = (c || '').toLowerCase();
  return Object.entries(CUISINE_FLAGS).find(([k]) => l.includes(k))?.[1] ?? '🍽️';
}

/* ─── Difficulty colour ─────────────────────────── */
function getDifficultyStyle(d: string): React.CSSProperties {
  const l = (d || '').toLowerCase();
  if (l === 'easy')                return { color: '#4ade80' };
  if (l === 'moderate' || l === 'medium') return { color: '#fbbf24' };
  if (l === 'hard')                return { color: 'var(--accent)' };
  if (l === 'expert')              return { color: '#f87171' };
  return { color: 'var(--text-tertiary)' };
}

/* ─── Normalise ingredient emoji ────────────────── */
function resolveEmoji(name: string, providedEmoji?: string): string {
  // If backend already gave us a real emoji (not a colour dot), use it
  if (providedEmoji && providedEmoji.length <= 4 && !/^[⚫⚪🔴🟠🟡🟢🔵🟣🟤]$/.test(providedEmoji)) {
    return providedEmoji;
  }
  // Use the project's own emoji resolver
  try { return getIngredientEmoji(name) || '🥄'; } catch { return '🥄'; }
}

/* ─── Flatten all ingredient formats into one list ── */
interface FlatIngredient { name: string; qty: string; emoji: string }

function flattenIngredients(recipe: Record<string, any>): FlatIngredient[] {
  const result: FlatIngredient[] = [];

  // Format A: flat array  recipe.ingredients[]
  if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
    recipe.ingredients.forEach((i: any) => {
      const name = String(i.name || i.ingredient || '').trim();
      if (!name) return;
      const qty = [i.quantity != null ? String(i.quantity) : '', i.unit || ''].filter(Boolean).join(' ');
      result.push({ name, qty, emoji: resolveEmoji(name, i.emoji) });
    });
    return result;
  }

  // Format B: category map  recipe.categories{}
  if (recipe.categories && typeof recipe.categories === 'object') {
    Object.values(recipe.categories).forEach((group: any) => {
      if (!Array.isArray(group)) return;
      group.forEach((i: any) => {
        const name = String(i.name || '').trim();
        if (!name) return;
        const qty = [i.quantity != null ? String(i.quantity) : '', i.unit || ''].filter(Boolean).join(' ');
        result.push({ name, qty, emoji: resolveEmoji(name, i.emoji) });
      });
    });
  }

  return result;
}

/* ─── Flatten all step formats into strings ─────── */
function flattenSteps(recipe: Record<string, any>): { text: string; time?: string }[] {
  const raw = recipe.steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((s: any) => {
    if (typeof s === 'string') return { text: s };
    const parts = [s.title, s.description].filter(Boolean);
    return { text: parts.join(': ') || '', time: s.time || s.duration || '' };
  }).filter(s => s.text);
}

/* ─── Extract tips ──────────────────────────────── */
function extractTips(recipe: Record<string, any>): string[] {
  if (Array.isArray(recipe.tips)) return recipe.tips.filter((t: any) => typeof t === 'string' && t);
  if (typeof recipe.tip === 'string' && recipe.tip) return [recipe.tip];
  return [];
}

/* ─── Extract nutrition ─────────────────────────── */
function extractNutrition(recipe: Record<string, any>): [string, string][] {
  const src = recipe.nutrition || recipe.nutrition_total || {};
  return Object.entries(src)
    .filter(([, v]) => v != null && String(v) !== '')
    .map(([k, v]) => [k, String(v)]);
}

/* ─── Section label ─────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-tertiary)',
      margin: '0 0 10px', lineHeight: 1,
    }}>
      {children}
    </p>
  );
}

/* ─── Inline action button ──────────────────────── */
function Btn({
  onClick, active, activeColor, icon, label,
}: {
  onClick: () => void; active?: boolean; activeColor?: string; icon: string; label: string;
}) {
  const [hov, setHov] = useState(false);
  const col = activeColor ?? 'var(--accent)';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 8,
        fontSize: 13, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer',
        border: `1px solid ${active ? col + '40' : 'var(--border)'}`,
        background: active ? col + '18' : hov ? 'var(--accent-alpha-10)' : 'var(--bg-elevated)',
        color: active ? col : hov ? 'var(--accent)' : 'var(--text-secondary)',
        transition: 'all 0.15s',
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export interface RecipeMarkdownProps {
  recipe: Record<string, any>;
  cached?: boolean;   // ⚡ Instant badge — came from DB
  index?: number;     // for multi-recipe display
}

export default function RecipeMarkdown({ recipe, cached, index }: RecipeMarkdownProps) {
  const apiBase  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';
  const getToken = () => { try { return localStorage.getItem('gharka_token'); } catch { return null; } };

  /* ── State ── */
  const [doneSets,    setDoneSets]    = useState<Set<number>>(new Set());
  const [liked,       setLiked]       = useState(false);
  const [disliked,    setDisliked]    = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [likeCount,   setLikeCount]   = useState(0);
  const [dislikeCount,setDislikeCount]= useState(0);
  const [userReaction,setUserReaction]= useState<'like' | 'dislike' | null>(null);
  const [videoRequested, setVideoRequested] = useState(false);

  /* ── Normalise ── */
  const meta       = recipe.meta || {};
  const title      = String(recipe.title || recipe.name || 'Recipe').trim();
  const description= String(recipe.description || '').trim();
  const cuisine    = String(meta.cuisine        || recipe.cuisine        || '').trim();
  const difficulty = String(meta.difficulty     || recipe.difficulty     || '').trim();
  const time       = String(meta.estimated_time || recipe.estimated_time || recipe.time || '').trim();
  const servings   = recipe.servings;
  const tags: string[] = Array.isArray(recipe.tags) ? recipe.tags.filter((t: any) => typeof t === 'string') : [];
  const isCached   = cached || recipe.cached === true || recipe.from_cache === true;

  const ingredients = flattenIngredients(recipe);
  const steps       = flattenSteps(recipe);
  const tips        = extractTips(recipe);
  const nutrition   = extractNutrition(recipe);
  const recipeKey   = String(recipe.recipe_key || title.toLowerCase().replace(/\s+/g, '-'));

  /* ── Load reaction counts on mount ── */
  useEffect(() => {
    if (!recipeKey) return;
    fetch(`${apiBase}/recipes/${encodeURIComponent(recipeKey)}/reactions`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j) {
          setLikeCount(j.likes ?? 0);
          setDislikeCount(j.dislikes ?? 0);
          // Restore user's previous reaction from response if included
          if (j.user_reaction === 'like')    { setLiked(true);    setUserReaction('like');    }
          if (j.user_reaction === 'dislike') { setDisliked(true); setUserReaction('dislike'); }
        }
      })
      .catch(() => {});
  }, [apiBase, recipeKey]);

  /* ── React (like/dislike) — toggleable, stores count in DB ── */
  const reactTo = async (action: 'like' | 'dislike') => {
    const token = getToken();
    if (!token) { alert('Please login to react'); return; }
    // Optimistic UI update first
    const isSame = userReaction === action;
    if (action === 'like') {
      const next = isSame ? null : 'like';
      setUserReaction(next);
      setLiked(next === 'like');
      setDisliked(false);
      setLikeCount(c => isSame ? Math.max(0, c - 1) : c + 1);
      if (!isSame && userReaction === 'dislike') setDislikeCount(c => Math.max(0, c - 1));
    } else {
      const next = isSame ? null : 'dislike';
      setUserReaction(next);
      setDisliked(next === 'dislike');
      setLiked(false);
      setDislikeCount(c => isSame ? Math.max(0, c - 1) : c + 1);
      if (!isSame && userReaction === 'like') setLikeCount(c => Math.max(0, c - 1));
    }
    // Sync to backend
    try {
      const method = isSame ? 'DELETE' : 'POST';
      const res = await fetch(`${apiBase}/recipes/${encodeURIComponent(recipeKey)}/react`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const j = await res.json();
        // Reconcile with server counts
        setLikeCount(j.likes ?? likeCount);
        setDislikeCount(j.dislikes ?? dislikeCount);
      }
    } catch {}
  };

  const share = async () => {
    const text = [
      title,
      cuisine ? `${getCuisineFlag(cuisine)} ${cuisine}` : '',
      '',
      ingredients.length ? `Ingredients:\n${ingredients.map(i => `• ${i.emoji} ${i.name}${i.qty ? ` — ${i.qty}` : ''}`).join('\n')}` : '',
      steps.length ? `\nSteps:\n${steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n')}` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const findVideo = () => {
    setVideoRequested(true);
    try { window.dispatchEvent(new CustomEvent('requestVideoSearch', { detail: { title } })); } catch {}
    setTimeout(() => setVideoRequested(false), 3000);
  };

  const toggleStep = (i: number) => setDoneSets(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <div style={{ color: 'var(--text-primary)', lineHeight: 1.8, fontSize: 15 }}>

      {/* ── Multi-recipe counter ── */}
      {index !== undefined && (
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--accent)',
          margin: '0 0 6px', opacity: 0.75,
        }}>
          Recipe {index + 1}
        </p>
      )}

      {/* ── Title row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{
          fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
          margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em',
        }}>
          {title}
        </h2>
        {isCached && (
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 99,
            background: 'rgba(74,222,128,0.12)', color: '#4ade80',
            border: '1px solid rgba(74,222,128,0.25)',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            ⚡ Instant
          </span>
        )}
      </div>

      {/* ── Meta line: cuisine · difficulty · time · servings ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 14,
        fontSize: 13, color: 'var(--text-tertiary)',
        marginBottom: description ? 14 : 18,
        alignItems: 'center',
      }}>
        {cuisine    && <span>{getCuisineFlag(cuisine)} {cuisine}</span>}
        {difficulty && <span style={{ fontWeight: 600, ...getDifficultyStyle(difficulty) }}>● {difficulty}</span>}
        {time       && <span>⏱ {time}</span>}
        {servings   && <span>👥 Serves {servings}</span>}
      </div>

      {/* ── Description ── */}
      {description && (
        <p style={{
          fontSize: 14, color: 'var(--text-secondary)',
          lineHeight: 1.75, fontStyle: 'italic',
          borderLeft: '3px solid var(--accent-alpha-30)',
          paddingLeft: 12, margin: '0 0 18px',
        }}>
          {description}
        </p>
      )}

      {/* ── Tags ── */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 18 }}>
          {tags.map(t => (
            <span key={t} style={{
              fontSize: 11, padding: '2px 9px', borderRadius: 99,
              background: 'var(--accent-alpha-10)', color: 'var(--accent)',
              border: '1px solid var(--accent-alpha-30)', fontWeight: 500,
            }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* ══ INGREDIENTS ══════════════════════════════
          Plain emoji list — no boxes, no grid
          Each line: 🧄  Garlic             3 cloves
      ═══════════════════════════════════════════ */}
      {ingredients.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Ingredients</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ingredients.map((ing, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Emoji */}
                <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>
                  {ing.emoji}
                </span>
                {/* Quantity — right-aligned, muted */}
                {ing.qty && (
                  <span style={{
                    fontSize: 13, color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {ing.qty}
                  </span>
                )}
                {/* Name */}
                <span style={{
                  color: 'var(--text-primary)', fontWeight: 500,
                  flex: 1, fontSize: 14,
                }}>
                  {ing.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sponsor banner (placeholder) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed var(--border)',
          borderRadius: 12,
          background: 'var(--bg-elevated)',
          color: 'var(--text-tertiary)',
          fontSize: 12,
          fontWeight: 600,
          height: 80,
          marginBottom: 16,
        }}
      >
        Sponsored Banner (Google Ads placeholder)
      </div>

      {/* ══ STEPS ════════════════════════════════════
          Numbered prose, tap to strike-through
      ═══════════════════════════════════════════ */}
      {steps.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Instructions</SectionLabel>
          <p style={{ fontSize: 12, color: 'var(--text-disabled)', margin: '0 0 12px', fontStyle: 'italic' }}>
            Tap a step to mark it done
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {steps.map((step, i) => {
              const isDone = doneSets.has(i);
              return (
                <div
                  key={i}
                  onClick={() => toggleStep(i)}
                  style={{
                    display: 'flex', gap: 14, alignItems: 'flex-start',
                    cursor: 'pointer', opacity: isDone ? 0.45 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {/* Circle number / checkmark */}
                  <span style={{
                    minWidth: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2, fontSize: 12, fontWeight: 700,
                    background: isDone ? 'rgba(74,222,128,0.15)' : 'var(--accent-alpha-15)',
                    color:      isDone ? '#4ade80'               : 'var(--accent)',
                    border:     isDone ? '1px solid rgba(74,222,128,0.30)' : '1px solid var(--accent-alpha-30)',
                    transition: 'all 0.18s',
                  }}>
                    {isDone ? '✓' : i + 1}
                  </span>

                  {/* Step text + optional time hint */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      lineHeight: 1.7, margin: 0,
                      textDecoration: isDone ? 'line-through' : 'none',
                    }}>
                      {step.text}
                    </p>
                    {step.time && !isDone && (
                      <p style={{ fontSize: 11, color: 'var(--accent)', margin: '3px 0 0', opacity: 0.75 }}>
                        ⏱ {step.time}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TIPS ═════════════════════════════════════
          Left-bordered callout, no heavy box
      ═══════════════════════════════════════════ */}
      {tips.length > 0 && (
        <div style={{
          marginBottom: 24, padding: '12px 14px', borderRadius: 10,
          background: 'var(--accent-alpha-10)', borderLeft: '3px solid var(--accent)',
        }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            margin: '0 0 8px', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            💡 Chef Tips
          </p>
          {tips.map((tip, i) => (
            <p key={i} style={{
              fontSize: 14, color: 'var(--text-secondary)',
              lineHeight: 1.65, margin: i < tips.length - 1 ? '0 0 6px' : 0,
            }}>
              › {tip}
            </p>
          ))}
        </div>
      )}

      {/* ══ NUTRITION ════════════════════════════════
          Simple inline emoji row
      ═══════════════════════════════════════════ */}
      {nutrition.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            {nutrition.map(([key, val]) => {
              const k = key.toLowerCase();
              const emoji = k.includes('calor') || k.includes('energy') || k.includes('kcal') ? '🔥'
                : k.includes('fat') ? '🥑'
                : k.includes('carb') ? '🍞'
                : k.includes('protein') ? '💪'
                : k.includes('fiber') || k.includes('fibre') ? '🌾'
                : k.includes('sugar') ? '🍯'
                : k.includes('sodium') || k.includes('salt') ? '🧂'
                : '•';
              return (
                <span key={key} style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  <span style={{ marginRight: 4 }}>{emoji}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
                  {' '}
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{key}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ ACTIONS ══════════════════════════════════
          Like · Dislike · Share · Print
          + 3 separate module links below
      ═══════════════════════════════════════════ */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>

        {/* Reaction + utility buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <Btn
            onClick={() => reactTo('like')} active={liked} activeColor="#4ade80"
            icon="👍" label={`Like${likeCount > 0 ? ` ${likeCount}` : ''}`}
          />
          <Btn
            onClick={() => reactTo('dislike')} active={disliked} activeColor="#f87171"
            icon="👎" label={`Dislike${dislikeCount > 0 ? ` ${dislikeCount}` : ''}`}
          />
          <Btn onClick={share} active={false} icon={copied ? '✓' : '🔗'} label={copied ? 'Copied!' : 'Share'} />
          <Btn onClick={() => window.print()} active={false} icon="🖨️" label="Print" />
        </div>

        {/* 3 separate module links — clearly distinct */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          paddingTop: 10, borderTop: '1px solid var(--border)',
        }}>
          {/* 1. Find a Chef */}
          <a href="/find-chef" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, padding: '5px 11px', borderRadius: 8,
            color: 'var(--text-secondary)', textDecoration: 'none',
            border: '1px solid var(--border)', background: 'var(--bg-elevated)',
            fontWeight: 500, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--accent-alpha-40)'; el.style.color='var(--accent)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--border)'; el.style.color='var(--text-secondary)'; }}
          >
            👨‍🍳 Find a Chef
          </a>

          {/* 2. Restaurant Near You */}
          <a href="/restaurants" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, padding: '5px 11px', borderRadius: 8,
            color: 'var(--text-secondary)', textDecoration: 'none',
            border: '1px solid var(--border)', background: 'var(--bg-elevated)',
            fontWeight: 500, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--accent-alpha-40)'; el.style.color='var(--accent)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--border)'; el.style.color='var(--text-secondary)'; }}
          >
            🍽️ Restaurant Near You
          </a>

          {/* 3. Watch Video */}
          <button
            onClick={findVideo}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, padding: '5px 11px', borderRadius: 8,
              color: videoRequested ? 'var(--accent)' : 'var(--text-secondary)',
              border: `1px solid ${videoRequested ? 'var(--accent-alpha-40)' : 'var(--border)'}`,
              background: videoRequested ? 'var(--accent-alpha-10)' : 'var(--bg-elevated)',
              fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--accent-alpha-40)'; el.style.color='var(--accent)'; }}
            onMouseLeave={e => {
              if (!videoRequested) {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor='var(--border)'; el.style.color='var(--text-secondary)';
              }
            }}
          >
            {videoRequested ? '⏳ Searching…' : '▶ Watch Video'}
          </button>
        </div>
      </div>
    </div>
  );
}
