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
  const [showShare, setShowShare]   = React.useState(false);
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

  const shareOn = (platform: 'whatsapp' | 'twitter' | 'facebook' | 'copy') => {
    const pageUrl = encodeURIComponent(window.location.href);
    const text    = encodeURIComponent(`Check out this recipe: ${recipe.name || 'Recipe'}`);
    let url = '';
    if (platform === 'whatsapp') url = `https://wa.me/?text=${text}%20${pageUrl}`;
    else if (platform === 'twitter') url = `https://twitter.com/intent/tweet?text=${text}&url=${pageUrl}`;
    else if (platform === 'facebook') url = `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`;
    else {
      navigator.clipboard?.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => { setCopied(false); setShowShare(false); }, 2000);
      });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setShowShare(false);
  };

  const printRecipe = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const ings: any[]  = recipe.ingredients || [];
    const stps: any[]  = recipe.steps || [];
    const nutr: any    = recipe.nutrition || {};
    const metaLine = [recipe.cuisine, recipe.difficulty, recipe.time && `⏱ ${recipe.time}`, recipe.servings_display].filter(Boolean).join(' · ');
    const html = `<!DOCTYPE html><html><head><title>${recipe.name || 'Recipe'}</title>
<style>
  body{font-family:Georgia,serif;max-width:680px;margin:0 auto;padding:28px;color:#222}
  .brand{display:flex;align-items:center;gap:12px;border-bottom:2px solid #e5712e;padding-bottom:12px;margin-bottom:20px}
  .brand img{width:60px;height:60px;object-fit:contain}
  .brand-name{font-size:20px;font-weight:700;color:#e5712e}
  h1{font-size:26px;margin:0 0 6px}
  .meta{font-size:13px;color:#666;margin:0 0 16px}
  h2{font-size:16px;border-bottom:1px solid #eee;padding-bottom:4px;margin:20px 0 10px;text-transform:uppercase;letter-spacing:.06em;color:#444}
  .ing{display:flex;gap:8px;margin:5px 0;font-size:14px}
  .ing-qty{color:#888;white-space:nowrap}
  .step{display:flex;gap:12px;margin:10px 0;font-size:14px;line-height:1.6}
  .step-n{font-weight:700;color:#e5712e;min-width:22px;flex-shrink:0}
  @media print{@page{margin:18mm}}
</style>
</head><body>
<div class="brand">
  <img src="${window.location.origin}/logo.png" onerror="this.style.display='none'" />
  <div class="brand-name">Chefsy</div>
</div>
<h1>${recipe.name || 'Recipe'}</h1>
${metaLine ? `<div class="meta">${metaLine}</div>` : ''}
${recipe.description ? `<p style="font-style:italic;color:#555;font-size:14px;line-height:1.7;margin:0 0 16px">${recipe.description}</p>` : ''}
${ings.length ? `<h2>Ingredients</h2>${ings.map((i: any) => `<div class="ing"><span class="ing-qty">${i.quantity || ''} ${i.unit || ''}</span><span>${i.name || ''}</span></div>`).join('')}` : ''}
${stps.length ? `<h2>Instructions</h2>${stps.map((s: any, idx: number) => `<div class="step"><span class="step-n">${idx + 1}.</span><span>${typeof s === 'string' ? s : (s.description || s.title || '')}</span></div>`).join('')}` : ''}
${Object.keys(nutr).length ? `<h2>Nutrition</h2><div style="display:flex;flex-wrap:wrap;gap:14px;font-size:13px">${Object.entries(nutr).map(([k, v]) => `<span><strong>${v}</strong> ${k}</span>`).join('')}</div>` : ''}
</body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
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

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowShare(s => !s)} className="gk-btn-ghost" style={showShare ? { background: 'var(--accent-alpha-10)', color: 'var(--accent)', borderColor: 'var(--accent-alpha-30)' } : {}}>
            ↗ Share
          </button>

          {showShare && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 50,
              marginTop: 6, background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 12,
              padding: '10px 12px', display: 'flex', gap: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}>
              <button onClick={() => shareOn('whatsapp')} title="WhatsApp" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#25D366', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'inherit' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </button>
              <button onClick={() => shareOn('twitter')} title="Twitter/X" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'inherit' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Twitter / X
              </button>
              <button onClick={() => shareOn('facebook')} title="Facebook" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#1877F2', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'inherit' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </button>
              <button onClick={() => shareOn('copy')} title="Copy link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: copied ? '#4ade80' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'inherit' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          )}
        </div>

        <button onClick={printRecipe} className="gk-btn-ghost gk-no-print">
          🖨️ Print
        </button>
      </div>
    </div>
  );
}
