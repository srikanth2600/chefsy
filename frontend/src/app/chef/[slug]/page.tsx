'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChefThemeProvider, useChefTheme } from '@/components/chef/ChefThemeContext';
import { Avatar, Pill, Btn, SLabel, Stars, ThemeToggle } from '@/components/chef/ui';
import type { Chef, AppearanceTheme } from '@/components/chef/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

interface Reel {
  id: number;
  title: string;
  description?: string;
  hashtags: string[];
  video_url?: string;
  video_file_path?: string;
  platform?: string;
  thumbnail?: string;
  status: string;
  view_count: number;
  created_at: string;
}

function recipeEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('biryani') || t.includes('rice')) return '🍚';
  if (t.includes('chicken') || t.includes('poultry')) return '🍗';
  if (t.includes('fish') || t.includes('seafood') || t.includes('prawn')) return '🐟';
  if (t.includes('cake') || t.includes('dessert') || t.includes('sweet')) return '🎂';
  if (t.includes('bread') || t.includes('roti') || t.includes('naan')) return '🫓';
  if (t.includes('soup') || t.includes('broth')) return '🍲';
  if (t.includes('salad')) return '🥗';
  if (t.includes('pasta') || t.includes('noodle')) return '🍝';
  if (t.includes('egg')) return '🥚';
  return '🍳';
}

function getYouTubeId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1]?.split('?')[0] || '';
    return u.searchParams.get('v') || '';
  } catch { return ''; }
}

function splitTags(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

// ─── Reel Player Modal ─────────────────────────────────────────────────────────
function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov')) return 'direct';
  return 'other';
}

function ReelPlayer({ reel, accent }: { reel: Reel; accent: string }) {
  const platform = reel.platform || (reel.video_url ? detectPlatform(reel.video_url) : null);
  const ytId     = platform === 'youtube' && reel.video_url ? getYouTubeId(reel.video_url) : '';
  const vimId    = platform === 'vimeo'   && reel.video_url ? (reel.video_url.split('/').pop() || '') : '';
  const isFile   = platform === 'upload';
  const isDirect = platform === 'direct' || platform === 'other';
  const isLink   = platform === 'facebook' || platform === 'instagram';

  if (ytId) return (
    <iframe
      src={`https://www.youtube.com/embed/${ytId}?rel=0&autoplay=1&playsinline=1`}
      title="YouTube" frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
    />
  );
  if (vimId) return (
    <iframe
      src={`https://player.vimeo.com/video/${vimId}?autoplay=1`}
      title="Vimeo" frameBorder="0" allow="autoplay; fullscreen" allowFullScreen
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
    />
  );
  if (isFile && reel.video_file_path) return (
    <video controls autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} src={`${API}${reel.video_file_path}`} />
  );
  if (isDirect && reel.video_url) return (
    <video controls autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} src={reel.video_url} />
  );
  if (isLink && reel.video_url) return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#111' }}>
      <div style={{ fontSize: 48 }}>{platform === 'facebook' ? '📘' : '📷'}</div>
      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: 0 }}>Open in {platform === 'facebook' ? 'Facebook' : 'Instagram'}</p>
      <a href={reel.video_url} target="_blank" rel="noreferrer" style={{ color: accent, fontSize: 13, padding: '9px 22px', border: `1px solid ${accent}55`, borderRadius: 10, textDecoration: 'none', background: `${accent}15` }}>↗ Watch Video</a>
    </div>
  );
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <div style={{ fontSize: 64, opacity: 0.2 }}>🎬</div>
    </div>
  );
}

function ReelModal({ reels, initialIndex, accent, onClose }: {
  reels: Reel[]; initialIndex: number; accent: string; onClose: () => void;
}) {
  const [idx, setIdx] = useState(Math.max(0, Math.min(initialIndex, reels.length - 1)));
  const touchStartY = useRef<number | null>(null);
  const reel = reels[idx];

  const goNext = () => setIdx(i => Math.min(reels.length - 1, i + 1));
  const goPrev = () => setIdx(i => Math.max(0, i - 1));

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!reel) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}
      onTouchStart={e => { touchStartY.current = e.touches[0].clientY; }}
      onTouchEnd={e => {
        if (touchStartY.current === null) return;
        const diff = touchStartY.current - e.changedTouches[0].clientY;
        if (diff > 60) goNext();
        else if (diff < -60) goPrev();
        touchStartY.current = null;
      }}
    >
      {/* Phone-shaped container */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 390, height: '88vh', maxHeight: 820, borderRadius: 28, overflow: 'hidden', background: '#000', boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 32px 80px rgba(0,0,0,0.8)' }}>

        {/* Video fills full phone screen */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <ReelPlayer key={reel.id} reel={reel} accent={accent} />
        </div>

        {/* Top bar: close + counter */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)', zIndex: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {reels.map((_, i) => (
              <div key={i} onClick={() => setIdx(i)} style={{ height: 3, flex: 1, minWidth: 20, maxWidth: 40, borderRadius: 2, background: i === idx ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'background 0.2s' }} />
            ))}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0, marginLeft: 10 }}>✕</button>
        </div>

        {/* Bottom info overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '48px 16px 24px', background: 'linear-gradient(transparent, rgba(0,0,0,0.88))', zIndex: 10, pointerEvents: 'none' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 5px', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{reel.title}</p>
          {reel.description && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '0 0 6px', lineHeight: 1.4 }}>{reel.description}</p>}
          {reel.hashtags?.length > 0 && (
            <p style={{ fontSize: 12, color: accent, margin: 0, fontWeight: 600 }}>
              {reel.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}
            </p>
          )}
        </div>

        {/* Up arrow (prev) */}
        {idx > 0 && (
          <button onClick={goPrev} style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(-60px)', zIndex: 10, width: 38, height: 38, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>↑</button>
        )}

        {/* Down arrow (next) */}
        {idx < reels.length - 1 && (
          <button onClick={goNext} style={{ position: 'absolute', top: '50%', right: 14, transform: 'translateY(20px)', zIndex: 10, width: 38, height: 38, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>↓</button>
        )}

        {/* Reel count badge */}
        <div style={{ position: 'absolute', top: 56, right: 16, zIndex: 10, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: '3px 8px', backdropFilter: 'blur(4px)' }}>
          {idx + 1} / {reels.length}
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function SharePopup({ slug, chefName, accent, t, onClose }: { slug: string; chefName: string; accent: string; t: any; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/chef/${slug}` : `/chef/${slug}`;
  const doShare = (platform: string) => {
    const text = encodeURIComponent(`Check out ${chefName}'s chef profile!`);
    const url = encodeURIComponent(profileUrl);
    let shareUrl = '';
    if (platform === 'whatsapp') shareUrl = `https://wa.me/?text=${text}%20${url}`;
    else if (platform === 'twitter') shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    else if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    else { navigator.clipboard?.writeText(profileUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }); return; }
    if (shareUrl) window.open(shareUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };
  const platforms = [
    {
      id: 'whatsapp', label: 'WhatsApp', color: '#25D366',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
    },
    {
      id: 'instagram', label: 'Instagram', color: '#E1306C',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>,
    },
    {
      id: 'facebook', label: 'Facebook', color: '#1877F2',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
    },
    {
      id: 'twitter', label: 'Twitter / X', color: '#000000',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    },
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 380, background: t.bgElevated, borderRadius: 22, border: `1px solid ${t.border}`, padding: '24px 20px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, margin: 0 }}>Share {chefName.split(' ')[0]}'s Profile</p>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.textTertiary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', fontSize: 13 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          {platforms.map(p => (
            <button key={p.id} onClick={() => doShare(p.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 6px 10px', borderRadius: 14, border: `1px solid ${t.border}`, background: t.bgSurface, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = `${p.color}12`)}
              onMouseLeave={e => (e.currentTarget.style.background = t.bgSurface)}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${p.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.color }}>{p.icon}</div>
              <span style={{ fontSize: 9, color: t.textTertiary, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{p.label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => doShare('copy')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${copied ? accent : t.border}`, background: copied ? `${accent}12` : t.bgSurface, color: copied ? accent : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, transition: 'all 0.15s', boxSizing: 'border-box' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          {copied ? '✓ Link Copied to Clipboard!' : 'Copy Profile Link'}
        </button>
      </div>
    </div>
  );
}

const EMPTY_CHEF: Chef = {
  id: 0, name: '', slug: '', role: '', speciality: '', location: '', rating: null,
  review_count: 0, recipe_count: 0, follower_count: 0, verified: false, featured: false,
  avatar_color: '#DA7756', plan: 'free', bio: '', cuisine_tags: [], videos: [],
  experience_years: null, certifications: [],
};

// ─── Main page ────────────────────────────────────────────────────────────────
function ChefProfilePage() {
  const { t, isDark } = useChefTheme();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [chef, setChef]             = useState<Chef>(EMPTY_CHEF);
  const [loading, setLoading]       = useState(true);
  const [aboutOpen, setAboutOpen]   = useState(true);
  const [shareOpen, setShareOpen]   = useState(false);
  const [activeReel, setActiveReel] = useState<Reel | null>(null);
  const [appTheme, setAppTheme]     = useState<AppearanceTheme>({ banner_color: '#DA7756', accent_color: '#DA7756', font: 'Georgia, serif', bg_style: 'dark' });
  const [roles, setRoles]           = useState<string[]>([]);
  const [isMobile, setIsMobile]     = useState(false);
  type RecipeItem = { id: number; recipe_key: string; title: string; like_count: number; image_url?: string | null; cuisine?: string; difficulty?: string; cook_time?: string; description?: string; ingredients?: { name: string; quantity: string; unit: string }[]; steps?: string[]; tips?: string; hashtags?: string[] };
  const [recipes, setRecipes]       = useState<RecipeItem[]>([]);
  const [reels, setReels]           = useState<Reel[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<RecipeItem | null>(null);
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>({});
  // Per-recipe reaction counts fetched from backend
  const [recipeReactions, setRecipeReactions] = useState<Record<number, { likes: number; dislikes: number; user_reaction: string | null }>>({});
  type RecipeAction = { liked: boolean; disliked: boolean; rating: number; review: string; submitted: boolean; reviewOpen: boolean };
  const [recipeActions, setRecipeActions] = useState<Record<number, RecipeAction>>({});
  const [msgOpen, setMsgOpen]       = useState(false);
  const [msgForm, setMsgForm]       = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [msgSent, setMsgSent]       = useState(false);
  const [captcha, setCaptcha]       = useState({ q: '3 + 7', a: 10 });
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaError, setCaptchaError]   = useState(false);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const getRA = (id: number): RecipeAction => recipeActions[id] ?? { liked: false, disliked: false, rating: 0, review: '', submitted: false, reviewOpen: false };
  const patchRA = (id: number, p: Partial<RecipeAction>) => setRecipeActions(prev => ({ ...prev, [id]: { ...getRA(id), ...p } }));

  // Load reactions from backend when a recipe is opened + track view
  const loadReactions = (recipe: RecipeItem) => {
    if (!recipe.recipe_key) return;
    // Track view (fire-and-forget)
    fetch(`${API}/recipes/${recipe.recipe_key}/view`, { method: 'POST' }).catch(() => {});
    if (recipeReactions[recipe.id]) return;
    const tok = (() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } })();
    fetch(`${API}/recipes/${recipe.recipe_key}/reactions`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      setRecipeReactions(prev => ({ ...prev, [recipe.id]: { likes: d.likes || 0, dislikes: d.dislikes || 0, user_reaction: d.user_reaction || null } }));
      if (d.user_reaction === 'like') patchRA(recipe.id, { liked: true });
      else if (d.user_reaction === 'dislike') patchRA(recipe.id, { disliked: true });
    }).catch(() => {});
  };

  // Send like/dislike to backend
  const sendReaction = (recipe: RecipeItem, action: 'like' | 'dislike') => {
    const tok = (() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } })();
    if (!tok) return; // silently skip if not logged in
    fetch(`${API}/recipes/${recipe.recipe_key}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ action }),
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      setRecipeReactions(prev => ({ ...prev, [recipe.id]: { ...prev[recipe.id], likes: d.likes || 0, dislikes: d.dislikes || 0 } }));
    }).catch(() => {});
  };

  const removeReaction = (recipe: RecipeItem) => {
    const tok = (() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } })();
    if (!tok) return;
    fetch(`${API}/recipes/${recipe.recipe_key}/react`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok}` },
    }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      setRecipeReactions(prev => ({ ...prev, [recipe.id]: { ...prev[recipe.id], likes: d.likes || 0, dislikes: d.dislikes || 0 } }));
    }).catch(() => {});
  };

  // Submit review to backend
  const submitReview = (recipe: RecipeItem, rating: number, reviewText: string) => {
    const tok = (() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } })();
    if (!tok) return;
    fetch(`${API}/recipes/${recipe.recipe_key}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ rating, review_text: reviewText }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (msgOpen) {
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      setCaptcha({ q: `${a} + ${b}`, a: a + b });
      setCaptchaAnswer('');
      setCaptchaError(false);
      setMsgForm({ name: '', email: '', phone: '', subject: '', message: '' });
      setMsgSent(false);
    }
  }, [msgOpen]);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      fetch(`${API}/chefs/${slug}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/chefs/${slug}/roles`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/chefs/${slug}/recipes?per_page=24`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/chefs/${slug}/reels?per_page=50`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([profile, rolesData, recipesData, reelsData]) => {
      if (profile) {
        setChef({
          id: profile.id, name: profile.name || '', slug: profile.slug,
          role: profile.designation || '', speciality: profile.cuisine_speciality || '',
          location: profile.location || '', rating: profile.rating ?? null,
          review_count: profile.review_count ?? 0, recipe_count: profile.recipe_count ?? 0,
          follower_count: profile.follower_count ?? 0,
          verified: profile.is_verified ?? false, featured: profile.is_featured ?? false,
          avatar_color: profile.avatar_color || '#DA7756',
          avatar_url: profile.avatar_url, banner_url: profile.banner_url,
          bio: profile.bio, cuisine_tags: profile.cuisine_tags ?? [],
          youtube_url: profile.youtube_url, instagram_url: profile.instagram_url,
          website_url: profile.website_url, appearance_theme: profile.appearance_theme,
          plan: profile.plan ?? 'free', videos: [],
          experience_years: profile.experience_years ?? null,
          certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
        });
        setAppTheme(profile.appearance_theme || { banner_color: profile.avatar_color || '#DA7756', accent_color: '#DA7756', font: 'Georgia, serif', bg_style: 'dark' });
      }
      if (rolesData?.roles) setRoles(rolesData.roles.map((r: any) => r.name));
      if (recipesData?.recipes) setRecipes(recipesData.recipes.map((r: any) => ({
        id: r.id, recipe_key: r.recipe_key || '', title: r.title || '', like_count: r.like_count || 0,
        image_url: r.image_url || null, cuisine: r.cuisine || '',
        difficulty: r.difficulty || '', cook_time: r.cook_time || '',
        description: r.description || '',
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        tips: r.tips || '',
        hashtags: r.hashtags || [],
      })));
      if (reelsData?.reels) setReels(reelsData.reels.filter((r: Reel) => r.status === 'active'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [slug]);

  const pageBg = appTheme.bg_style === 'warm' ? (isDark ? '#1A1208' : '#F5EDD8')
    : appTheme.bg_style === 'forest' ? (isDark ? '#0D1A14' : '#E8F2EC')
    : t.bg;
  const accent = appTheme.accent_color || '#DA7756';
  const avatarUrl = chef.avatar_url ? (chef.avatar_url.startsWith('/media') ? `${API}${chef.avatar_url}` : chef.avatar_url) : undefined;
  const bannerBg  = chef.banner_url
    ? `url(${chef.banner_url.startsWith('/media') ? API + chef.banner_url : chef.banner_url}) center/cover no-repeat`
    : `linear-gradient(135deg,${appTheme.banner_color}55,${appTheme.banner_color}99)`;

  // ── split speciality + cuisine_tags by comma into individual pills ──
  const allTags = [...new Set([
    ...(chef.speciality ? splitTags(chef.speciality) : []),
    ...(Array.isArray(chef.cuisine_tags) ? chef.cuisine_tags.flatMap(splitTags) : []),
  ])];

  if (loading) return (
    <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: t.textTertiary, fontSize: 13 }}>Loading…</p>
    </div>
  );

  const linkStyle: React.CSSProperties = { padding: '7px 13px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.textSecondary, fontSize: 12, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 };

  return (
    <div style={{ height: '100vh', overflowY: 'auto', overflowX: 'hidden', background: pageBg }}>

      {/* Banner */}
      <div style={{ height: 180, background: bannerBg, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,0.025) 20px,rgba(255,255,255,0.025) 40px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.45))' }} />
        <div style={{ position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/'); }} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.5)', color: '#F5EFE6', cursor: 'pointer', fontSize: 16, backdropFilter: 'blur(8px)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {chef.featured && <div style={{ background: 'rgba(218,119,86,0.92)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: 99, letterSpacing: '0.06em' }}>★ Featured</div>}
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 18px 60px' }}>

        {/* Avatar + action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: -48, marginBottom: 10 }}>
          <div style={{ flexShrink: 0, border: `4px solid ${pageBg}`, borderRadius: 20, overflow: 'hidden', display: 'inline-block' }}>
            {avatarUrl ? (
              <Avatar name={chef.name} color={chef.avatar_color} imageUrl={avatarUrl} size={96} radius={16} verified={chef.verified} verifiedColor={accent} verifiedBorder={pageBg} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: 16, background: `linear-gradient(135deg,${chef.avatar_color}cc,${chef.avatar_color}77)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, position: 'relative' }}>
                👨‍🍳
                {chef.verified && <div style={{ position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 99, background: accent, border: `2px solid ${pageBg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>✓</div>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, paddingBottom: 4, position: 'relative' }}>
            <button onClick={() => setShareOpen(v => !v)} style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${t.border}`, background: t.bgCard, color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <button onClick={() => setMsgOpen(true)} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: accent, color: '#fff', cursor: 'pointer', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>💬</button>
            {shareOpen && <SharePopup slug={slug} chefName={chef.name} accent={accent} t={t} onClose={() => setShareOpen(false)} />}
          </div>
        </div>

        {/* Name + roles */}
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 21, fontWeight: 900, color: t.textPrimary, margin: '0 0 3px', fontFamily: appTheme.font, lineHeight: 1.15 }}>{chef.name || '—'}</h1>
          {(roles.length > 0 || (chef.role && chef.role !== 'Chef')) && (
            <p style={{ fontSize: 12, color: accent, margin: '0 0 8px', fontWeight: 600 }}>{roles.length > 0 ? roles.join(' · ') : chef.role}</p>
          )}
          {/* Each comma-separated speciality/cuisine item as its own pill */}
          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {allTags.map(tag => <Pill key={tag} accent t={t}>{tag}</Pill>)}
            </div>
          )}
        </div>

        {/* Stats */}
        {chef.review_count > 0 && (
          <div style={{ display: 'flex', padding: '10px 0', borderBottom: `1px solid ${t.border}`, marginBottom: 14 }}>
            {([[ chef.review_count, 'Reviews'], [`★ ${chef.rating ?? '—'}`, 'Rating']] as [any,string][]).map(([v,l]) => (
              <div key={l} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.textPrimary, fontFamily: appTheme.font, lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* About Me */}
        <div style={{ marginBottom: 14, background: t.bgCard, borderRadius: 14, border: `1px solid ${t.border}`, overflow: 'hidden' }}>
          <button onClick={() => setAboutOpen(v => !v)} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', color: t.textPrimary, fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>
            <span>📖 About Me</span>
            <span style={{ fontSize: 10, color: t.textTertiary, transform: aboutOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
          </button>
          {aboutOpen && (
            <div style={{ padding: '0 16px 16px' }}>
              {chef.bio && <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${t.border}`, fontSize: 13, color: t.textSecondary, lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: chef.bio }} />}
              {chef.experience_years != null && <div style={{ marginBottom: 12 }}><SLabel t={t}>Experience</SLabel><p style={{ fontSize: 13, color: t.textSecondary, margin: '4px 0 0' }}>{chef.experience_years} {chef.experience_years === 1 ? 'year' : 'years'} in professional kitchens</p></div>}
              {chef.certifications && chef.certifications.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <SLabel t={t}>Certifications & Awards</SLabel>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {chef.certifications.map((cert, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: t.accentBg, color: t.accent, border: `1px solid ${t.borderAcc}`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>🏅 {cert}</span>)}
                  </div>
                </div>
              )}
              {chef.location && <p style={{ fontSize: 12, color: t.textSecondary, margin: '0 0 10px' }}>📍 {chef.location}</p>}
              {(chef.instagram_url || chef.youtube_url || chef.website_url) && (
                <div><SLabel t={t}>Connect</SLabel>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {chef.instagram_url && (
                      <a href={chef.instagram_url} target="_blank" rel="noreferrer"
                        style={{ ...linkStyle, color: '#E1306C', borderColor: 'rgba(225,48,108,0.3)', background: 'rgba(225,48,108,0.08)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                        Instagram
                      </a>
                    )}
                    {chef.youtube_url && (
                      <a href={chef.youtube_url} target="_blank" rel="noreferrer"
                        style={{ ...linkStyle, color: '#FF0000', borderColor: 'rgba(255,0,0,0.3)', background: 'rgba(255,0,0,0.08)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.54C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75,15.02 15.5,12 9.75,8.98 9.75,15.02" fill="white"/></svg>
                        YouTube
                      </a>
                    )}
                    {chef.website_url && (
                      <a href={chef.website_url} target="_blank" rel="noreferrer" style={linkStyle}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        Website
                      </a>
                    )}
                  </div>
                </div>
              )}
              {!chef.bio && chef.experience_years == null && !chef.certifications?.length && !chef.location && !chef.instagram_url && !chef.youtube_url && !chef.website_url && <p style={{ fontSize: 12, color: t.textTertiary, margin: 0 }}>No information added yet.</p>}
            </div>
          )}
        </div>

        {/* Reviews summary */}
        {chef.review_count > 0 && (
          <div style={{ marginBottom: 20, padding: '12px 16px', background: t.bgCard, borderRadius: 14, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: t.textPrimary, fontFamily: appTheme.font, lineHeight: 1 }}>{chef.rating ?? '—'}</div>
            <div><Stars rating={chef.rating} /><p style={{ fontSize: 11, color: t.textTertiary, margin: '4px 0 0' }}>{chef.review_count} {chef.review_count === 1 ? 'review' : 'reviews'}</p></div>
          </div>
        )}

        {/* ══ REELS — shown first ══ */}
        {reels.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>🎬</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary, letterSpacing: '-0.01em' }}>Reels</span>
              <span style={{ fontSize: 11, color: t.textTertiary }}>{reels.length} video{reels.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {reels.map(reel => {
                const reelPlatform = reel.platform || (reel.video_url ? detectPlatform(reel.video_url) : null);
                const ytId = reelPlatform === 'youtube' && reel.video_url ? getYouTubeId(reel.video_url) : '';
                const thumb = ytId
                  ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
                  : reel.thumbnail
                    ? (reel.thumbnail.startsWith('/media') ? `${API}${reel.thumbnail}` : reel.thumbnail)
                    : null;
                const platformLabel = reelPlatform === 'youtube' ? 'YT' : reelPlatform === 'instagram' ? 'IG' : reelPlatform === 'facebook' ? 'FB' : reelPlatform === 'vimeo' ? 'VI' : '▶';
                return (
                  <div key={reel.id} onClick={() => setActiveReel(reel)} style={{ position: 'relative', aspectRatio: '9/14', cursor: 'pointer', overflow: 'hidden', borderRadius: 8, background: `linear-gradient(160deg,${chef.avatar_color}55 0%,#111 100%)` }}>
                    {thumb
                      ? <img src={thumb} alt={reel.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (
                        <>
                          {/* Uploaded video: show a cinematic gradient placeholder */}
                          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg,${chef.avatar_color}88 0%,#0a0a0a 100%)` }} />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: 28, opacity: 0.55 }}>🎬</div>
                          </div>
                        </>
                      )
                    }
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 35%,rgba(0,0,0,0.8))' }} />
                    {/* Play button */}
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)', border: '1.5px solid rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 12, color: '#fff', marginLeft: 3 }}>▶</span>
                    </div>
                    {/* Platform badge */}
                    <div style={{ position: 'absolute', top: 6, left: 6 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.65)', color: '#fff', letterSpacing: '0.03em' }}>{platformLabel}</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 7px' }}>
                      <p style={{ fontSize: 9, color: '#fff', margin: '0 0 2px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reel.title}</p>
                      {reel.view_count > 0 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.75)' }}>👁 {reel.view_count}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ DISCOVER RECIPES — below reels ══ */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🍳</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary, letterSpacing: '-0.01em' }}>Discover Recipes</span>
            {recipes.length > 0 && <span style={{ fontSize: 11, color: t.textTertiary }}>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</span>}
          </div>
          {recipes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: t.textTertiary }}>
              <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 10 }}>🍳</div>
              <p style={{ fontSize: 13 }}>No recipes yet</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {recipes.map((item, i) => (
                <div key={`recipe-${item.id}`} onClick={() => { setActiveRecipe(item); loadReactions(item); }} style={{ position: 'relative', aspectRatio: '1', background: `linear-gradient(135deg,${chef.avatar_color}22,${t.bgCard})`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 34, opacity: 0.28 }}>{recipeEmoji(item.title)}</span>
                  }
                  <div style={{ position: 'absolute', inset: 0, padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'linear-gradient(transparent 50%,rgba(0,0,0,0.7))' }}>
                    <p style={{ fontSize: 9, color: '#fff', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reel player modal */}
      {activeReel && (
        <ReelModal
          reels={reels}
          initialIndex={reels.findIndex(r => r.id === activeReel.id)}
          accent={accent}
          onClose={() => setActiveReel(null)}
        />
      )}

      {/* Recipe detail modal */}
      {activeRecipe && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }}
          onClick={e => e.target === e.currentTarget && setActiveRecipe(null)}
        >
          <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 580, maxHeight: isMobile ? '94vh' : '90vh', background: t.bg, borderRadius: isMobile ? '24px 24px 0 0' : 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${t.border}`, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

            {/* Hero image */}
            <div style={{ flexShrink: 0, height: isMobile ? 180 : 220, background: activeRecipe.image_url ? `url(${activeRecipe.image_url}) center/cover` : `linear-gradient(135deg,${accent}55,${accent}22)`, position: 'relative' }}>
              {!activeRecipe.image_url && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, opacity: 0.13 }}>{recipeEmoji(activeRecipe.title)}</div>}
              <button onClick={() => setActiveRecipe(null)} style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', fontFamily: 'inherit' }}>✕</button>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '28px 16px 14px', background: 'linear-gradient(transparent,rgba(0,0,0,0.78))' }}>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {activeRecipe.cuisine && <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.6)', color: '#F5EFE6', padding: '2px 9px', borderRadius: 99, fontWeight: 600 }}>{activeRecipe.cuisine}</span>}
                  {activeRecipe.difficulty && <span style={{ fontSize: 10, background: `${accent}99`, color: '#fff', padding: '2px 9px', borderRadius: 99, fontWeight: 700 }}>{activeRecipe.difficulty}</span>}
                  {activeRecipe.cook_time && <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.6)', color: '#F5EFE6', padding: '2px 9px', borderRadius: 99 }}>⏱ {activeRecipe.cook_time}</span>}
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 32px' }}>

              {/* Title */}
              <h2 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 900, color: t.textPrimary, margin: '0 0 14px', fontFamily: appTheme.font, lineHeight: 1.2 }}>{activeRecipe.title}</h2>

              {/* Chef row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: chef.avatar_color, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👨‍🍳'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary, margin: 0 }}>{chef.name}</p>
                  <p style={{ fontSize: 10, color: accent, margin: 0 }}>{chef.role}</p>
                </div>
              </div>

              {/* Action row: Like, Dislike, Rate & Review */}
              {(() => {
                const ra = getRA(activeRecipe.id);
                const rx = recipeReactions[activeRecipe.id];
                return (
                  <>
                    <div style={{ display: 'flex', gap: 7, paddingBottom: 14, borderBottom: `1px solid ${t.border}`, marginBottom: 18, flexWrap: 'wrap' }}>
                      <button onClick={() => {
                        const next = !ra.liked;
                        patchRA(activeRecipe.id, { liked: next, disliked: false });
                        if (next) sendReaction(activeRecipe, 'like');
                        else removeReaction(activeRecipe);
                      }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${ra.liked ? '#22C55E' : t.border}`, background: ra.liked ? 'rgba(34,197,94,0.12)' : 'transparent', color: ra.liked ? '#22C55E' : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={ra.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                        Like{rx && rx.likes > 0 ? ` ${rx.likes}` : ''}
                      </button>
                      <button onClick={() => {
                        const next = !ra.disliked;
                        patchRA(activeRecipe.id, { disliked: next, liked: false });
                        if (next) sendReaction(activeRecipe, 'dislike');
                        else removeReaction(activeRecipe);
                      }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${ra.disliked ? '#EF4444' : t.border}`, background: ra.disliked ? 'rgba(239,68,68,0.12)' : 'transparent', color: ra.disliked ? '#EF4444' : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={ra.disliked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
                        Dislike{rx && rx.dislikes > 0 ? ` ${rx.dislikes}` : ''}
                      </button>
                      <button onClick={() => patchRA(activeRecipe.id, { reviewOpen: !ra.reviewOpen })}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${ra.submitted || ra.reviewOpen ? accent : t.border}`, background: ra.submitted ? `${accent}12` : 'transparent', color: ra.submitted ? accent : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill={ra.submitted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        {ra.submitted ? 'Rated ✓' : 'Rate & Review'}
                      </button>
                    </div>

                    {/* Rating panel */}
                    {ra.reviewOpen && !ra.submitted && (
                      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>Your Rating</p>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                          {[1,2,3,4,5].map(star => (
                            <button key={star} onClick={() => patchRA(activeRecipe.id, { rating: star })}
                              style={{ width: 36, height: 36, borderRadius: 9, border: `1.5px solid ${ra.rating >= star ? accent : t.border}`, background: ra.rating >= star ? `${accent}15` : 'transparent', color: ra.rating >= star ? accent : t.textTertiary, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'all 0.12s' }}>★</button>
                          ))}
                          {ra.rating > 0 && <span style={{ fontSize: 11, color: t.textTertiary, marginLeft: 4 }}>{ra.rating}/5</span>}
                        </div>
                        <textarea
                          value={ra.review}
                          onChange={e => patchRA(activeRecipe.id, { review: e.target.value })}
                          placeholder="Share your thoughts about this recipe…"
                          rows={3}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 12, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6, marginBottom: 10 }}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => patchRA(activeRecipe.id, { reviewOpen: false })} style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>Cancel</button>
                          <button
                            onClick={() => {
                              if (ra.rating > 0) {
                                patchRA(activeRecipe.id, { submitted: true, reviewOpen: false });
                                submitReview(activeRecipe, ra.rating, ra.review);
                              }
                            }}
                            style={{ flex: 2, padding: '8px', borderRadius: 10, border: 'none', background: ra.rating > 0 ? `linear-gradient(135deg,${accent},${accent}cc)` : t.bgSurface, color: ra.rating > 0 ? '#fff' : t.textTertiary, cursor: ra.rating > 0 ? 'pointer' : 'default', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                            Submit Review
                          </button>
                        </div>
                      </div>
                    )}
                    {ra.submitted && (
                      <div style={{ background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 12, padding: '10px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>✅</span>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary, margin: 0 }}>Review submitted!</p>
                          <p style={{ fontSize: 10, color: t.textTertiary, margin: 0 }}>You rated this recipe {ra.rating}/5 ★</p>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Description */}
              {activeRecipe.description && (
                <div style={{ marginBottom: 22, fontSize: 13, color: t.textSecondary, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: activeRecipe.description }} />
              )}

              {/* Ingredients */}
              {(activeRecipe.ingredients?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>🧂 Ingredients</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 6 }}>
                    {activeRecipe.ingredients!.map((ing, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: t.bgCard, borderRadius: 10, border: `1px solid ${t.border}` }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: t.textPrimary, margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof ing === 'string' ? ing : ing.name}</p>
                          {typeof ing !== 'string' && (ing.quantity || ing.unit) && (
                            <p style={{ fontSize: 10, color: t.textTertiary, margin: 0 }}>{ing.quantity} {ing.unit}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preparation Steps */}
              {(activeRecipe.steps?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>📋 Preparation Steps</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeRecipe.steps!.map((step, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 14px', background: t.bgCard, borderRadius: 11, border: `1px solid ${t.border}` }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, background: t.accentBg, border: `1px solid ${t.borderAcc}`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                        <p style={{ fontSize: 13, color: t.textPrimary, margin: 0, lineHeight: 1.65, flex: 1 }}>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chef's Tips */}
              {activeRecipe.tips && (
                <div style={{ marginBottom: 22 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>💡 Chef's Tips</p>
                  <div style={{ padding: '13px 16px', background: `${accent}12`, border: `1px solid ${accent}30`, borderRadius: 12 }}>
                    <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.75, margin: 0 }}>{activeRecipe.tips}</p>
                  </div>
                </div>
              )}

              {/* Hashtags */}
              {(activeRecipe.hashtags?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeRecipe.hashtags!.map((tag, i) => (
                    <span key={i} style={{ fontSize: 11, color: accent, background: `${accent}12`, border: `1px solid ${accent}30`, borderRadius: 99, padding: '3px 10px', fontWeight: 600 }}>
                      {String(tag).startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Fallback if nothing */}
              {!activeRecipe.description && !(activeRecipe.ingredients?.length) && !(activeRecipe.steps?.length) && !activeRecipe.tips && (
                <p style={{ fontSize: 13, color: t.textTertiary, margin: 0 }}>No details added yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message modal — centered, full form */}
      {msgOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9200, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '12px' : '20px' }}
          onClick={e => e.target === e.currentTarget && setMsgOpen(false)}>
          <div style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', background: t.bgElevated, borderRadius: 22, border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: chef.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>
                {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👨‍🍳'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, margin: 0 }}>Message {chef.name.split(' ')[0]}</p>
                <p style={{ fontSize: 11, color: t.textTertiary, margin: 0 }}>{chef.role}{chef.location ? ` · ${chef.location}` : ''}</p>
              </div>
              <button onClick={() => setMsgOpen(false)} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.textTertiary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', fontSize: 13, flexShrink: 0 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {msgSent ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: t.textPrimary, margin: '0 0 8px', fontFamily: appTheme.font }}>Message Sent!</p>
                  <p style={{ fontSize: 13, color: t.textSecondary, margin: '0 0 24px', lineHeight: 1.6 }}>{chef.name.split(' ')[0]} will get back to you soon.</p>
                  <Btn t={t} onClick={() => setMsgOpen(false)}>Done</Btn>
                </div>
              ) : (
                <>
                  {/* Row 1: Name + Email */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Your Name *</label>
                      <input
                        value={msgForm.name} onChange={e => setMsgForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Priya Sharma"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Email *</label>
                      <input
                        type="email" value={msgForm.email} onChange={e => setMsgForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Phone + Subject */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Contact Number *</label>
                      <input
                        type="tel" value={msgForm.phone}
                        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setMsgForm(f => ({ ...f, phone: v })); }}
                        placeholder="10-digit number"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${msgForm.phone && msgForm.phone.length !== 10 ? '#EF4444' : t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                      {msgForm.phone && msgForm.phone.length !== 10 && <p style={{ fontSize: 10, color: '#EF4444', margin: '3px 0 0' }}>Must be exactly 10 digits</p>}
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Subject *</label>
                      <input
                        value={msgForm.subject} onChange={e => setMsgForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="e.g. Cooking class booking"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Message *</label>
                    <textarea
                      value={msgForm.message} onChange={e => setMsgForm(f => ({ ...f, message: e.target.value }))}
                      placeholder={`Hi ${chef.name.split(' ')[0]}, I'd love to…`}
                      rows={isMobile ? 3 : 4}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Captcha */}
                  <div style={{ marginBottom: 18, background: t.bgCard, border: `1px solid ${captchaError ? '#EF4444' : t.border}`, borderRadius: 12, padding: '12px 14px' }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                      🔐 Security Check — What is {captcha.q}?
                    </label>
                    <input
                      type="number" value={captchaAnswer} onChange={e => { setCaptchaAnswer(e.target.value); setCaptchaError(false); }}
                      placeholder="Enter the answer"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${captchaError ? '#EF4444' : t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {captchaError && <p style={{ fontSize: 10, color: '#EF4444', margin: '4px 0 0' }}>Incorrect answer — please try again</p>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn variant="ghost" t={t} style={{ flex: 1 }} onClick={() => setMsgOpen(false)}>Cancel</Btn>
                    <Btn t={t} style={{ flex: 2 }} onClick={() => {
                      const f = msgForm;
                      if (!f.name.trim() || !f.email.trim() || f.phone.length !== 10 || !f.subject.trim() || !f.message.trim()) return;
                      if (parseInt(captchaAnswer) !== captcha.a) { setCaptchaError(true); return; }
                      setMsgSent(true);
                    }}>Send Message →</Btn>
                  </div>
                  <p style={{ fontSize: 10, color: t.textTertiary, margin: '10px 0 0', textAlign: 'center' }}>All fields marked * are required</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChefProfileWrapper() {
  return (
    <ChefThemeProvider>
      <ChefProfilePage />
    </ChefThemeProvider>
  );
}
