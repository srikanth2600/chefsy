'use client';
import React from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';

/* ── Helpers ── */
function diffClass(d: string) {
  const l = (d || '').toLowerCase();
  if (l === 'easy')     return 'gk-pill gk-diff-easy';
  if (l === 'moderate') return 'gk-pill gk-diff-moderate';
  if (l === 'hard')     return 'gk-pill gk-diff-hard';
  if (l === 'expert')   return 'gk-pill gk-diff-expert';
  return 'gk-pill';
}
function diffEmoji(d: string) {
  const l = (d || '').toLowerCase();
  if (l === 'easy')     return '🟢';
  if (l === 'moderate') return '🟡';
  if (l === 'hard')     return '🟠';
  if (l === 'expert')   return '🔴';
  return '';
}

interface RecipeHeaderProps {
  recipe: any;
  logoUrl: string;
  recipeImageUrl?: string;
}

export default function RecipeHeader({ recipe, logoUrl, recipeImageUrl }: RecipeHeaderProps) {
  const [liked, setLiked]           = React.useState(false);
  const [disliked, setDisliked]     = React.useState(false);
  const [bookmarked, setBookmarked] = React.useState(false);
  const [copied, setCopied]         = React.useState(false);
  const [likesCount, setLikesCount] = React.useState<number | null>(null);
  const [dislikesCount, setDislikesCount] = React.useState<number | null>(null);

  const avatarSrc = recipeImageUrl || logoUrl;
  const getToken  = () => { try { return localStorage.getItem('gharka_token'); } catch { return null; } };

  // Fetch current reaction and counts on mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = getToken();
        const headers: any = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${apiBase}/recipes/${encodeURIComponent(recipe.recipe_key)}/reaction`, { headers });
        if (!res.ok) return;
        const j = await res.json();
        if (!mounted) return;
        setLikesCount(typeof j.likes === 'number' ? j.likes : 0);
        setDislikesCount(typeof j.dislikes === 'number' ? j.dislikes : 0);
        setLiked(j.reaction === 'like');
        setDisliked(j.reaction === 'dislike');
      } catch {}
    })();
    return () => { mounted = false; };
  }, [recipe.recipe_key]);

  const toggleLike = async (chatId?: number) => {
    const token = getToken();
    if (!token) { alert('Please login to like recipes'); return; }
    try {
      // If currently liked -> remove reaction
      if (liked) {
        const r = await fetch(`${apiBase}/recipes/${encodeURIComponent(recipe.recipe_key)}/react`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          setLiked(false); setDisliked(false);
          setLikesCount(typeof j.likes === 'number' ? j.likes : likesCount);
          setDislikesCount(typeof j.dislikes === 'number' ? j.dislikes : dislikesCount);
        }
        return;
      }

      // Otherwise set like
      const body = { action: 'like' } as any;
      if (chatId) body.chat_id = chatId;
      const r = await fetch(`${apiBase}/recipes/${encodeURIComponent(recipe.recipe_key)}/react`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('Failed to like');
      const j = await r.json();
      setLiked(true); setDisliked(false);
      setLikesCount(typeof j.likes === 'number' ? j.likes : likesCount);
      setDislikesCount(typeof j.dislikes === 'number' ? j.dislikes : dislikesCount);
    } catch (e) { /* ignore */ }
  };

  const toggleDislike = async (chatId?: number) => {
    const token = getToken();
    if (!token) { alert('Please login to dislike recipes'); return; }
    try {
      if (disliked) {
        const r = await fetch(`${apiBase}/recipes/${encodeURIComponent(recipe.recipe_key)}/react`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          setDisliked(false); setLiked(false);
          setLikesCount(typeof j.likes === 'number' ? j.likes : likesCount);
          setDislikesCount(typeof j.dislikes === 'number' ? j.dislikes : dislikesCount);
        }
        return;
      }
      const body: any = { action: 'dislike' };
      if (chatId) body.chat_id = chatId;
      const r = await fetch(`${apiBase}/recipes/${encodeURIComponent(recipe.recipe_key)}/react`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('Failed to dislike');
      const j = await r.json();
      setDisliked(true); setLiked(false);
      setLikesCount(typeof j.likes === 'number' ? j.likes : likesCount);
      setDislikesCount(typeof j.dislikes === 'number' ? j.dislikes : dislikesCount);
    } catch (e) { /* ignore */ }
  };

  const toggleBookmark = async () => {
    const token = getToken();
    if (!token) { alert('Please login to save recipes'); return; }
    const method = bookmarked ? 'DELETE' : 'POST';
    await fetch(`${apiBase}/recipes/${encodeURIComponent(recipe.recipe_key)}/bookmark`, {
      method, headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    setBookmarked(p => !p);
  };

  const shareRecipe = async () => {
    const ingredients = (recipe.ingredients || [])
      .map((i: any) => `• ${i.name}${i.quantity ? ` — ${i.quantity}` : ''}`)
      .join('\n');
    const steps = (recipe.steps || [])
      .map((s: any, i: number) => `${i + 1}. ${typeof s === 'string' ? s : s.description || ''}`)
      .join('\n');
    const text = `${recipe.name}\n\nIngredients:\n${ingredients}\n\nSteps:\n${steps}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { alert('Could not copy recipe'); }
  };

  const tags: string[]      = Array.isArray(recipe.tags) ? recipe.tags : [];
  const nutritionEntries    = Object.entries(recipe.nutrition || {});

  return (
    <div style={{ marginBottom: 4 }}>

      {/* ── Recipe identity ── */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <img
          src={avatarSrc}
          alt={recipe.name || 'Recipe'}
          style={{
            width: 52,
            height: 52,
            borderRadius: 'var(--radius-md)',
            objectFit: 'cover',
            flexShrink: 0,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
          }}
          onError={e => { try { (e.currentTarget as HTMLImageElement).src = logoUrl; } catch {} }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
            {recipe.name}
          </h3>
          {recipe.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.6, margin: '5px 0 0' }}>
              {recipe.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Meta pills ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {recipe.servings_display && (
          <span className="gk-pill">👥 {recipe.servings_display}</span>
        )}
        {recipe.time && (
          <span className="gk-pill">⏱ {recipe.time}</span>
        )}
        {recipe.difficulty && (
          <span className={diffClass(recipe.difficulty)}>
            {diffEmoji(recipe.difficulty)} {recipe.difficulty}
          </span>
        )}
        {recipe.cuisine && (
          <span className="gk-pill">🌍 {recipe.cuisine}</span>
        )}
      </div>

      {/* ── Tags ── */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {tags.map((t: string) => (
            <span key={t} className="gk-pill gk-pill-accent" style={{ fontSize: 11 }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* ── Nutrition ── */}
      {nutritionEntries.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14, alignItems: 'center' }}>
          {nutritionEntries.map(([k, v]: any) => {
            const lk = String(k).toLowerCase();
            const emoji = lk.includes('calor') || lk.includes('energy') || lk.includes('kcal') ? '🔥'
              : lk.includes('fat') ? '🥑'
              : lk.includes('carb') ? '🍞'
              : lk.includes('protein') ? '💪'
              : lk.includes('fiber') || lk.includes('fibre') ? '🌾'
              : lk.includes('sugar') ? '🍯'
              : lk.includes('sodium') || lk.includes('salt') ? '🧂'
              : '•';
            return (
              <span key={k} style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                <span style={{ marginRight: 4 }}>{emoji}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v}</span>
                {' '}
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{k}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => toggleLike((recipe as any).chat_id)}
          className="gk-btn-ghost"
          style={liked ? { background: 'rgba(92,184,92,0.12)', color: 'var(--success)', borderColor: 'rgba(92,184,92,0.3)' } : {}}
        >
          {liked ? '♥' : '♡'} Like {likesCount != null ? `(${likesCount})` : ''}
        </button>

        <button
          onClick={() => toggleDislike((recipe as any).chat_id)}
          className="gk-btn-ghost"
          style={disliked ? { background: 'rgba(224,72,72,0.08)', color: 'var(--danger)', borderColor: 'rgba(224,72,72,0.2)' } : {}}
        >
          {disliked ? '👎' : '👎'} Dislike {dislikesCount != null ? `(${dislikesCount})` : ''}
        </button>

        <button
          onClick={toggleBookmark}
          className="gk-btn-ghost"
          style={bookmarked ? { background: 'var(--accent-alpha-10)', color: 'var(--accent)', borderColor: 'var(--accent-alpha-30)' } : {}}
        >
          {bookmarked ? '🔖' : '📑'} {bookmarked ? 'Saved' : 'Save'}
        </button>

        <button onClick={shareRecipe} className="gk-btn-ghost">
          {copied ? '✓ Copied!' : '🔗 Share'}
        </button>

        <button onClick={() => window.print()} className="gk-btn-ghost gk-no-print">
          🖨️ Print
        </button>
      </div>
    </div>
  );
}
