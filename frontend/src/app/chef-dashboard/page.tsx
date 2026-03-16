'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChefTheme } from '@/components/chef/ChefThemeContext';
import { Avatar, Pill, Btn, SLabel, Card, VideoReelCard, fmtN } from '@/components/chef/ui';
import type { Chef, ChefVideo } from '@/components/chef/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

const _tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const EMPTY_CHEF: Chef = {
  id: 0, name: '', slug: '', role: 'Chef', speciality: '', location: '',
  rating: null, review_count: 0, recipe_count: 0, follower_count: 0,
  verified: false, featured: false, avatar_color: '#DA7756', plan: 'free', videos: [],
};

const API_BASE_CONST = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

function _getYtId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if (u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1]?.split('?')[0] || '';
    return u.searchParams.get('v') || '';
  } catch { return ''; }
}

// ─── Video Modal ──────────────────────────────────────────────────────────────
function VideoModal({ video, chefColor, onClose }: { video: any; chefColor: string; onClose: () => void }) {
  const isYt = video.platform === 'youtube' || (video.video_url || '').includes('youtube') || (video.video_url || '').includes('youtu.be');
  const ytId = isYt && video.video_url ? _getYtId(video.video_url) : '';
  const fileUrl = video.video_file_path ? `${API_BASE_CONST}${video.video_file_path}` : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14, alignItems: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#F5EFE6', margin: 0 }}>{video.title}</p>
          <button onClick={onClose} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#F5EFE6', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#000', position: 'relative' }}>
          {ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : fileUrl ? (
            <video src={fileUrl} controls autoPlay style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <>
              <div style={{ fontSize: 60, opacity: 0.07, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>🎬</div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: `linear-gradient(135deg,${chefColor}33,#000)` }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(218,119,86,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #DA7756' }}>
                  <span style={{ fontSize: 22, marginLeft: 4 }}>▶</span>
                </div>
                <p style={{ fontSize: 12, color: '#BCA98D', margin: 0 }}>No video source available</p>
              </div>
            </>
          )}
        </div>
        {(video.view_count ?? 0) > 0 && (
          <p style={{ fontSize: 11, color: '#7D6A52', margin: '8px 0 0', textAlign: 'center' }}>👁 {video.view_count} views</p>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { t } = useChefTheme();
  const router = useRouter();
  const [chef, setChef] = useState<Chef>(EMPTY_CHEF);
  const [recentRecipes, setRecentRecipes] = useState<any[]>([]);
  const [planUsage, setPlanUsage] = useState<{ recipes_used: number; recipes_limit: number; videos_used: number; videos_limit: number } | null>(null);
  const [activeVideo, setActiveVideo] = useState<any | null>(null);
  const [reels, setReels] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);

  useEffect(() => {
    const tok = _tok();
    if (!tok) return;
    const h = { Authorization: `Bearer ${tok}` };
    fetch(`${API}/chefs/me/profile`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setChef({ id: d.id, name: d.name || '', slug: d.slug, role: d.designation || 'Chef', speciality: d.cuisine_speciality || '', location: d.location || '', rating: d.rating, review_count: d.review_count ?? 0, recipe_count: d.recipe_count ?? 0, follower_count: d.follower_count ?? 0, verified: d.is_verified ?? false, featured: d.is_featured ?? false, avatar_color: d.avatar_color || '#DA7756', plan: d.plan ?? 'free', videos: [] });
      }).catch(() => {});
    fetch(`${API}/chefs/me/recipes?per_page=3`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.recipes) setRecentRecipes(d.recipes); }).catch(() => {});
    fetch(`${API}/chefs/me/plan-usage`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPlanUsage(d); }).catch(() => {});
    fetch(`${API}/chefs/me/reels?per_page=10`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.reels) setReels(d.reels); }).catch(() => {});
    fetch(`${API}/chefs/me/analytics`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAnalytics(d); }).catch(() => {});
  }, []);

  const isPro = chef.plan === 'pro';
  const planLimits = { recipes: planUsage?.recipes_limit ?? (isPro ? 10 : 3), videos: planUsage?.videos_limit ?? (isPro ? 5 : 1) };
  const used = { recipes: planUsage?.recipes_used ?? chef.recipe_count, videos: planUsage?.videos_used ?? 0 };

  const stats = [
    { icon: '👁', value: analytics ? fmtN(analytics.profile_views ?? 0) : '—', label: 'Views', color: t.accent },
    { icon: '🍳', value: String(chef.recipe_count), label: 'Recipes', color: t.success },
    { icon: '♥', value: analytics ? fmtN(analytics.total_likes ?? 0) : '—', label: 'Likes', color: '#F59E0B' },
    { icon: '👥', value: fmtN(chef.follower_count), label: 'Followers', color: '#60A5FA' },
    { icon: '🎬', value: String(reels.length || 0), label: 'Reels', color: '#A78BFA' },
  ];

  return (
    <div style={{ padding: '20px 20px 60px', background: t.bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: t.textPrimary, margin: '0 0 2px', fontFamily: 'Georgia, serif' }}>Welcome back{chef.name ? `, ${chef.name.split(' ')[0]}` : ''} 👋</h1>
          <p style={{ fontSize: 12, color: t.textSecondary, margin: 0 }}>Your chef studio dashboard</p>
        </div>
        <Btn t={t} onClick={() => router.push('/chef-dashboard/recipes')}>+ New Recipe</Btn>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 9, marginBottom: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: t.bgCard, border: `1px solid ${s.color}22`, borderRadius: 13, padding: '12px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -6, right: -6, fontSize: 30, opacity: 0.06 }}>{s.icon}</div>
            <div style={{ fontSize: 16, marginBottom: 3 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'monospace', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Videos / Reels */}
      <Card t={t} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: 0 }}>🎬 My Reels</p>
          <button onClick={() => router.push('/chef-dashboard/reels')} style={{ fontSize: 11, color: t.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Manage Reels →</button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {reels.map((reel: any) => {
            const isYt = reel.platform === 'youtube' || (reel.video_url || '').includes('youtube') || (reel.video_url || '').includes('youtu.be');
            let ytId = '';
            if (isYt && reel.video_url) {
              try {
                const u = new URL(reel.video_url);
                if (u.hostname.includes('youtu.be')) ytId = u.pathname.slice(1).split('?')[0];
                else if (u.pathname.includes('/shorts/')) ytId = u.pathname.split('/shorts/')[1]?.split('?')[0] || '';
                else ytId = u.searchParams.get('v') || '';
              } catch {}
            }
            const thumb = reel.thumbnail
              ? (reel.thumbnail.startsWith('/') ? `${API}${reel.thumbnail}` : reel.thumbnail)
              : ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;
            return (
              <div key={reel.id} onClick={() => setActiveVideo(reel)}
                style={{ flexShrink: 0, width: 96, aspectRatio: '9/16', position: 'relative', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: `linear-gradient(160deg,${chef.avatar_color}44,#111)`, border: `1px solid ${t.border}` }}>
                {thumb
                  ? <img src={thumb} alt={reel.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, opacity: 0.2 }}>🎬</div>
                }
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%,rgba(0,0,0,0.75))' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, color: '#fff', marginLeft: 2 }}>▶</span>
                </div>
                <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4 }}>
                  <p style={{ fontSize: 8, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{reel.title}</p>
                  {(reel.view_count ?? 0) > 0 && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)' }}>👁 {reel.view_count}</span>}
                </div>
              </div>
            );
          })}
          <div
            onClick={() => router.push('/chef-dashboard/reels/create')}
            style={{ flexShrink: 0, width: 96, aspectRatio: '9/16', background: t.bgSurface, border: `2px dashed ${t.border}`, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4, transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.borderAcc)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
          >
            <span style={{ fontSize: 18, opacity: 0.4 }}>＋</span>
            <span style={{ fontSize: 8, color: t.textTertiary, textAlign: 'center', padding: '0 6px', lineHeight: 1.3 }}>Add Reel</span>
          </div>
        </div>
      </Card>

      {/* Plan Usage */}
      <Card t={t} style={{ marginBottom: 14 }}>
        <SLabel t={t}>{isPro ? '✦ PRO PLAN — Unlimited' : 'FREE PLAN USAGE'}</SLabel>
        {Object.entries(used).map(([key, val]) => {
          const limit = planLimits[key as keyof typeof planLimits];
          const pct = Math.min((val / limit) * 100, 100);
          const over = val >= limit;
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.textSecondary, marginBottom: 4, textTransform: 'capitalize' }}>
                <span>{key}</span>
                <span style={{ fontWeight: 700, color: over ? t.error : t.textPrimary, fontFamily: 'monospace' }}>{val}/{limit}</span>
              </div>
              <div style={{ height: 5, background: t.bgSurface, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: over ? t.error : t.accent, borderRadius: 99, transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })}
        {!isPro && (
          <Btn t={t} style={{ width: '100%', padding: '8px', fontSize: 11, marginTop: 6 }}>
            ✦ Upgrade — 10 recipes · 5 videos · Full analytics
          </Btn>
        )}
      </Card>

      {/* Recent Recipes */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: 0 }}>Recent Recipes</p>
          <button onClick={() => router.push('/chef-dashboard/recipes')} style={{ fontSize: 11, color: t.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>See all →</button>
        </div>
        {recentRecipes.length === 0 && (
          <p style={{ fontSize: 12, color: t.textTertiary, textAlign: 'center', padding: '20px 0' }}>No recipes yet. Create your first recipe!</p>
        )}
        {recentRecipes.map((r) => (
          <div
            key={r.id}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 11, marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = t.borderAcc)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
          >
            <div style={{ width: 38, height: 38, borderRadius: 9, background: t.bgSurface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, opacity: 0.4, flexShrink: 0 }}>🍳</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
              <div style={{ display: 'flex', gap: 10, fontSize: 10, color: t.textTertiary }}>
                <span style={{ color: '#F59E0B' }}>♥ {r.like_count ?? 0}</span>
                {(r.dislike_count ?? 0) > 0 && <span>👎 {r.dislike_count}</span>}
                {(r.comment_count ?? 0) > 0 && <span>💬 {r.comment_count}</span>}
                <span>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeVideo && <VideoModal video={activeVideo} chefColor={chef.avatar_color} onClose={() => setActiveVideo(null)} />}
    </div>
  );
}
