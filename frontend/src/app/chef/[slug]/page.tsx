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

// ─── Share Popup ──────────────────────────────────────────────────────────────
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
  const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 6, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Share Profile</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn} onClick={() => doShare('whatsapp')}>📱 WhatsApp</button>
          <button style={btn} onClick={() => doShare('instagram')}>📸 Instagram</button>
          <button style={btn} onClick={() => doShare('facebook')}>👤 Facebook</button>
          <button style={btn} onClick={() => doShare('twitter')}>🐦 Twitter</button>
          <button style={{ ...btn, borderColor: copied ? accent : t.border, color: copied ? accent : t.textSecondary }} onClick={() => doShare('copy')}>{copied ? '✓ Copied!' : '🔗 Copy Link'}</button>
        </div>
      </div>
    </>
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
  const [recipes, setRecipes]       = useState<{ id: number; title: string; like_count: number }[]>([]);
  const [reels, setReels]           = useState<Reel[]>([]);
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>({});
  const [msgOpen, setMsgOpen]       = useState(false);
  const [msgText, setMsgText]       = useState('');
  const [msgSent, setMsgSent]       = useState(false);

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
      if (recipesData?.recipes) setRecipes(recipesData.recipes);
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
                    {chef.instagram_url && <a href={chef.instagram_url} target="_blank" rel="noreferrer" style={linkStyle}>📸 Instagram</a>}
                    {chef.youtube_url && <a href={chef.youtube_url} target="_blank" rel="noreferrer" style={linkStyle}>▶ YouTube</a>}
                    {chef.website_url && <a href={chef.website_url} target="_blank" rel="noreferrer" style={linkStyle}>🌐 Website</a>}
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
                <div key={`recipe-${item.id}`} style={{ position: 'relative', aspectRatio: '1', background: `linear-gradient(135deg,${chef.avatar_color}22,${t.bgCard})`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                  <span style={{ fontSize: 34, opacity: 0.28 }}>{recipeEmoji(item.title)}</span>
                  <div style={{ position: 'absolute', inset: 0, padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'linear-gradient(transparent 50%,rgba(0,0,0,0.7))' }}>
                    <p style={{ fontSize: 8, color: '#fff', margin: '0 0 2px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 8, color: '#F59E0B' }}>♥ {item.like_count}</span>
                      <button onClick={e => { e.stopPropagation(); setLikedPosts(lp => ({ ...lp, [i]: !lp[i] })); }} style={{ width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.5)', color: likedPosts[i] ? '#F59E0B' : 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>{likedPosts[i] ? '♥' : '♡'}</button>
                    </div>
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

      {/* Message modal */}
      {msgOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: t.overlay, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && setMsgOpen(false)}>
          <div style={{ width: '100%', maxWidth: 520, background: t.bgElevated, borderTopLeftRadius: 22, borderTopRightRadius: 22, border: `1px solid ${t.border}` }}>
            <div style={{ width: 32, height: 4, borderRadius: 99, background: t.border, margin: '10px auto 0' }} />
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: chef.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9 }} /> : '👨‍🍳'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: 0 }}>Message {chef.name.split(' ')[0]}</p>
                <p style={{ fontSize: 10, color: t.textTertiary, margin: 0 }}>{chef.role}</p>
              </div>
              <Btn variant="ghost" size="sm" t={t} onClick={() => setMsgOpen(false)}>✕</Btn>
            </div>
            <div style={{ padding: 18 }}>
              {msgSent ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: 38, marginBottom: 8 }}>✅</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary, margin: '0 0 4px' }}>Message sent!</p>
                  <p style={{ fontSize: 12, color: t.textSecondary, margin: '0 0 14px' }}>{chef.name.split(' ')[0]} will reply soon.</p>
                  <Btn t={t} onClick={() => setMsgOpen(false)}>Done</Btn>
                </div>
              ) : (
                <>
                  <textarea value={msgText} onChange={e => setMsgText(e.target.value)} placeholder={`Hi ${chef.name.split(' ')[0]}…`} rows={3} style={{ width: '100%', padding: 10, borderRadius: 11, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="ghost" t={t} style={{ flex: 1 }} onClick={() => setMsgOpen(false)}>Cancel</Btn>
                    <Btn t={t} style={{ flex: 2, opacity: msgText.trim() ? 1 : 0.5 }} onClick={() => msgText.trim() && setMsgSent(true)}>Send →</Btn>
                  </div>
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
