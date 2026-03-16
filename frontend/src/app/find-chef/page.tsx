'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChefThemeProvider, useChefTheme } from '@/components/chef/ChefThemeContext';
import {
  Avatar, Pill, Btn, SLabel, VideoReelCard,
  Stars, fmtN, ThemeToggle,
} from '@/components/chef/ui';
import type { Chef, Recipe, RecipeComment, ChefVideo } from '@/components/chef/types';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_CHEFS: Chef[] = [
  { id: 1, name: 'Srikanth Reddy', slug: 'srikanth', role: 'Head Chef', speciality: 'Hyderabadi', location: 'Hyderabad', rating: 4.8, review_count: 142, recipe_count: 24, follower_count: 1840, verified: true, featured: true, avatar_color: '#DA7756', plan: 'pro', videos: [{ id: 1, title: 'Dum Biryani Masterclass', youtube_url: '', duration: '18:42', view_count: '12k' }, { id: 2, title: 'Haleem from Scratch', youtube_url: '', duration: '22:10', view_count: '8.4k' }] },
  { id: 2, name: 'Priya Sharma', slug: 'priya', role: 'Pastry Chef', speciality: 'French', location: 'Mumbai', rating: 4.6, review_count: 89, recipe_count: 16, follower_count: 920, verified: true, featured: false, avatar_color: '#8B6C4F', plan: 'pro', videos: [{ id: 3, title: 'Croissant Secrets', youtube_url: '', duration: '14:30', view_count: '6.1k' }] },
  { id: 3, name: 'Rajan Nair', slug: 'rajan', role: 'Traditional Chef', speciality: 'Kerala', location: 'Kochi', rating: 4.9, review_count: 203, recipe_count: 31, follower_count: 3200, verified: true, featured: true, avatar_color: '#6B8E6B', plan: 'pro', videos: [{ id: 4, title: 'Fish Curry 3 Ways', youtube_url: '', duration: '26:05', view_count: '19k' }] },
  { id: 4, name: 'Ananya Gupta', slug: 'ananya', role: 'Nutritionist Chef', speciality: 'Healthy', location: 'Bengaluru', rating: 4.5, review_count: 67, recipe_count: 12, follower_count: 540, verified: false, featured: false, avatar_color: '#7B6B8E', plan: 'free', videos: [] },
  { id: 5, name: 'Vikram Malhotra', slug: 'vikram', role: 'Executive Chef', speciality: 'Mughlai', location: 'Delhi', rating: 4.7, review_count: 118, recipe_count: 29, follower_count: 2100, verified: true, featured: false, avatar_color: '#C45E3A', plan: 'pro', videos: [{ id: 5, title: 'Butter Chicken Deep Dive', youtube_url: '', duration: '20:18', view_count: '15k' }] },
];

const MOCK_RECIPES: Recipe[] = [
  { id: 1, title: 'Dum Biryani', chef: MOCK_CHEFS[0], cuisine: 'Hyderabadi', difficulty: 'Hard', cook_time: '2h', like_count: 521, comment_count: 18, emoji: '🍛', description: 'Authentic Hyderabadi Dum Biryani slow-cooked with aged basmati, whole spices and saffron milk.', steps: ['Marinate mutton 4 hours', 'Parboil rice to 70%', 'Layer in handi', 'Dum cook 45 min sealed'], ingredients: [{ name: 'Basmati Rice', quantity: '500', unit: 'g' }, { name: 'Mutton', quantity: '750', unit: 'g' }], nutrition: { calories: 680, protein: 38, carbs: 72, fat: 22 } },
  { id: 2, title: 'Croissants au Beurre', chef: MOCK_CHEFS[1], cuisine: 'French', difficulty: 'Expert', cook_time: '3h', like_count: 348, comment_count: 7, emoji: '🥐', description: 'Perfect laminated croissants with 27 layers of high-fat European butter.', steps: ['Make détrempe', 'Prepare butter block', '3 double folds', 'Proof & bake 200°C'] },
  { id: 3, title: 'Kerala Fish Curry', chef: MOCK_CHEFS[2], cuisine: 'South Indian', difficulty: 'Easy', cook_time: '30m', like_count: 192, comment_count: 5, emoji: '🐟', description: 'Traditional Kerala fish curry with kokum, coconut milk and fresh-ground masala.', steps: ['Grind masala paste', 'Temper & sauté', 'Add fish & kokum', 'Finish with coconut milk'] },
  { id: 4, title: 'Butter Chicken', chef: MOCK_CHEFS[4], cuisine: 'Mughlai', difficulty: 'Moderate', cook_time: '1h', like_count: 410, comment_count: 22, emoji: '🍗', description: 'Slow-simmered makhani gravy with charcoal-grilled chicken tikka.', steps: ['Marinate & grill', 'Blend makhani sauce', 'Simmer with cream', 'Add tikka'] },
  { id: 5, title: 'Palak Paneer', chef: MOCK_CHEFS[3], cuisine: 'North Indian', difficulty: 'Easy', cook_time: '40m', like_count: 276, comment_count: 11, emoji: '🥬', description: 'Velvety spinach gravy with fresh paneer, packed with nutrition.', steps: ['Blanch spinach', 'Make base', 'Blend & combine', 'Finish with cream'] },
  { id: 6, title: 'Haleem', chef: MOCK_CHEFS[0], cuisine: 'Hyderabadi', difficulty: 'Hard', cook_time: '4h', like_count: 334, comment_count: 9, emoji: '🍲', description: 'Slow-cooked mutton and lentil porridge — a Hyderabadi celebration dish.', steps: ['Soak dals overnight', 'Slow cook mutton 3h', 'Add dal & braise', 'Garnish & serve'] },
  { id: 7, title: 'Masala Dosa', chef: MOCK_CHEFS[3], cuisine: 'South Indian', difficulty: 'Moderate', cook_time: '45m', like_count: 445, comment_count: 31, emoji: '🫓', description: 'Crispy fermented rice crepe with spiced potato filling and chutneys.', steps: ['Ferment batter 8h', 'Prepare potato filling', 'Spread thin crepe', 'Serve with chutney'] },
  { id: 8, title: 'Rogan Josh', chef: MOCK_CHEFS[4], cuisine: 'Kashmiri', difficulty: 'Hard', cook_time: '2.5h', like_count: 289, comment_count: 14, emoji: '🥩', description: 'Aromatic braised lamb in Kashmiri spices — the jewel of Mughlai cuisine.', steps: ['Brown lamb pieces', 'Fry Kashmiri spices', 'Slow braise 2h', 'Finish with ghee'] },
];

const MOCK_COMMENTS: RecipeComment[] = [
  { id: 1, user_name: 'Priya M', user_color: '#8B6C4F', text: 'Made this on Sunday — absolute perfection!', time_ago: '2d', like_count: 14 },
  { id: 2, user_name: 'Ravi K', user_color: '#6B8E6B', text: 'The dum tip changed my biryani game forever 🔥', time_ago: '5d', like_count: 8 },
];

// ─── Breakpoint hook ──────────────────────────────────────────────────────────
type BP = 'mobile' | 'tablet' | 'desktop';
function useBreakpoint(): BP {
  const [bp, setBp] = useState<BP>('desktop');
  useEffect(() => {
    const fn = () => setBp(window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop');
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return bp;
}

// ─── Video Modal ──────────────────────────────────────────────────────────────
function VideoModal({ video, chef, onClose }: { video: ChefVideo; chef: Chef; onClose: () => void }) {
  const { t } = useChefTheme();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={chef.name} color={chef.avatar_color} size={32} radius={8} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F5EFE6', margin: 0 }}>{video.title}</p>
              <p style={{ fontSize: 10, color: '#BCA98D', margin: 0 }}>{chef.name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#F5EFE6', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ aspectRatio: '16/9', background: `linear-gradient(135deg,${chef.avatar_color}33,#0a0806)`, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${chef.avatar_color}30`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 100, opacity: 0.05, position: 'absolute' }}>🎬</div>
          <div style={{ width: 70, height: 70, borderRadius: '50%', background: `${chef.avatar_color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${chef.avatar_color}`, cursor: 'pointer', zIndex: 1, marginBottom: 14, boxShadow: `0 0 32px ${chef.avatar_color}40` }}>
            <span style={{ fontSize: 26, marginLeft: 5 }}>▶</span>
          </div>
          <p style={{ fontSize: 12, color: '#BCA98D', margin: 0, zIndex: 1 }}>{video.view_count} views · {video.duration}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'center' }}>
          {['♡ Like', '💬 Comment', '↗ Share'].map(a => (
            <button key={a} style={{ padding: '7px 18px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#BCA98D', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>{a}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Reel Video Modal ─────────────────────────────────────────────────────────
function ReelVideoModal({ reel, onClose }: { reel: any; onClose: () => void }) {
  const router = useRouter();

  function getYtId(url: string): string {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
      if (u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1]?.split('?')[0] || '';
      return u.searchParams.get('v') || '';
    } catch { return ''; }
  }

  const isYt = reel.platform === 'youtube' || (reel.video_url || '').includes('youtube') || (reel.video_url || '').includes('youtu.be');
  const ytId = isYt && reel.video_url ? getYtId(reel.video_url) : '';
  const isFile = reel.platform === 'upload' || (!reel.video_url && reel.video_file_path);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 540 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={reel.chef_name || ''} color={reel.chef_avatar_color || '#DA7756'} size={32} radius={8} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F5EFE6', margin: 0 }}>{reel.title}</p>
              <button onClick={() => { onClose(); router.push(`/chef/${reel.chef_slug}`); }}
                style={{ fontSize: 10, color: '#DA7756', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>
                {reel.chef_name} · View Profile →
              </button>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#F5EFE6', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', borderRadius: 16, overflow: 'hidden' }}>
          {ytId ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?rel=0&autoplay=1&playsinline=1`}
              title="YouTube" frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            />
          ) : isFile && reel.video_file_path ? (
            <video controls autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} src={`${API_BASE}${reel.video_file_path}`} />
          ) : reel.video_url ? (
            <video controls autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} src={reel.video_url} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: 'rgba(255,255,255,0.3)' }}>🎬</div>
          )}
        </div>
        {reel.description && (
          <p style={{ fontSize: 12, color: '#BCA98D', margin: '10px 0 0', lineHeight: 1.6 }}>{reel.description}</p>
        )}
        {reel.view_count > 0 && (
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '6px 0 0' }}>👁 {reel.view_count} views</p>
        )}
      </div>
    </div>
  );
}

// ─── Message Sheet ────────────────────────────────────────────────────────────
function MessageSheet({ chef, onClose }: { chef: Chef; onClose: () => void }) {
  const { t } = useChefTheme();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: t.overlay, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 560, background: t.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, border: `1px solid ${t.border}` }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: t.border, margin: '12px auto 0' }} />
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar name={chef.name} color={chef.avatar_color} size={44} radius={12} verified={chef.verified} verifiedColor={t.accent} verifiedBorder={t.bgElevated} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, margin: 0 }}>Message {chef.name.split(' ')[0]}</p>
            <p style={{ fontSize: 11, color: t.textTertiary, margin: 0 }}>{chef.role} · {chef.location}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textTertiary, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, margin: '0 0 6px' }}>Message sent!</p>
              <p style={{ fontSize: 12, color: t.textSecondary, margin: '0 0 20px' }}>{chef.name.split(' ')[0]} will reply soon.</p>
              <Btn t={t} onClick={onClose}>Done</Btn>
            </div>
          ) : (
            <>
              <textarea value={text} onChange={(e) => setText(e.target.value)}
                placeholder={`Hi ${chef.name.split(' ')[0]}, I'd love to book a cooking session…`}
                rows={4}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 12, lineHeight: 1.6 }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="ghost" t={t} style={{ flex: 1 }} onClick={onClose}>Cancel</Btn>
                <Btn t={t} style={{ flex: 2, opacity: text.trim() ? 1 : 0.5 }} onClick={() => text.trim() && setSent(true)}>Send Message →</Btn>
              </div>
              <p style={{ fontSize: 10, color: t.textTertiary, marginTop: 10, textAlign: 'center' }}>
                Free plan: 3 messages/month · <span style={{ color: t.accent, cursor: 'pointer' }}>Upgrade for unlimited</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Recipe Detail Modal ──────────────────────────────────────────────────────
function RecipeModal({ recipe, onClose, bp }: { recipe: Recipe; onClose: () => void; bp: BP }) {
  const { t } = useChefTheme();
  const router = useRouter();
  const isMob = bp === 'mobile';
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(recipe.like_count);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: isMob ? 'flex-end' : 'center', justifyContent: 'center', padding: isMob ? 0 : 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 620, maxHeight: isMob ? '92vh' : '88vh', background: t.bg, borderRadius: isMob ? '24px 24px 0 0' : 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${t.border}`, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ flexShrink: 0, height: isMob ? 180 : 220, background: `linear-gradient(160deg,${recipe.chef.avatar_color}66,${recipe.chef.avatar_color}cc)`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 160, opacity: 0.08 }}>{recipe.emoji}</div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%)' }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>✕</button>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 20px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.6)', color: '#F5EFE6', padding: '3px 10px', borderRadius: 99, fontWeight: 600 }}>{recipe.cuisine}</span>
              <span style={{ fontSize: 10, background: `${recipe.chef.avatar_color}88`, color: '#fff', padding: '3px 10px', borderRadius: 99, fontWeight: 700 }}>{recipe.difficulty}</span>
              <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.6)', color: '#F5EFE6', padding: '3px 10px', borderRadius: 99 }}>⏱ {recipe.cook_time}</span>
            </div>
            <h2 style={{ fontSize: isMob ? 22 : 28, fontWeight: 900, color: '#fff', margin: 0, fontFamily: 'Georgia, serif', textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{recipe.title}</h2>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottom: `1px solid ${t.border}`, marginBottom: 18 }}>
            <Avatar name={recipe.chef.name} color={recipe.chef.avatar_color} size={40} radius={10} verified={recipe.chef.verified} verifiedColor={t.accent} verifiedBorder={t.bg} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: 0 }}>{recipe.chef.name}</p>
              <p style={{ fontSize: 10, color: t.accent, margin: 0 }}>{recipe.chef.role}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setLiked(v => !v); setLikes(n => liked ? n-1 : n+1); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${liked ? '#22C55E' : t.border}`, background: liked ? 'rgba(34,197,94,0.12)' : 'transparent', color: liked ? '#22C55E' : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                {fmtN(likes)}
              </button>
              <Btn variant="ghost" size="sm" t={t} onClick={() => router.push(`/chef/${recipe.chef.slug}`)}>View Profile</Btn>
            </div>
          </div>
          {recipe.description && <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.8, marginBottom: 20 }}>{recipe.description}</p>}
          {recipe.steps && recipe.steps.length > 0 && (<>
            <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>Cooking Steps</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {recipe.steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 14px', background: t.bgCard, borderRadius: 11, border: `1px solid ${t.border}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: t.accentBg, border: `1px solid ${t.borderAcc}`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{i+1}</div>
                  <p style={{ fontSize: 13, color: t.textPrimary, margin: 0, lineHeight: 1.6 }}>{s}</p>
                </div>
              ))}
            </div>
          </>)}
          {recipe.nutrition && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[['🔥','Cal',recipe.nutrition.calories],['💪','Protein',`${recipe.nutrition.protein}g`],['🌾','Carbs',`${recipe.nutrition.carbs}g`],['🥑','Fat',`${recipe.nutrition.fat}g`]].map(([icon,label,val]) => (
                <div key={String(label)} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.textPrimary, fontFamily: 'monospace' }}>{val}</div>
                  <div style={{ fontSize: 9, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CHEF CARD — Portrait card for grid layout ────────────────────────────────
function ChefCard({ chef, onMsg, onClick, bp }: {
  chef: Chef; followed?: boolean;
  onFollow?: () => void; onMsg: () => void; onClick: () => void; bp: BP;
}) {
  const { t } = useChefTheme();
  const [hov, setHov] = useState(false);

  const avatarUrl = chef.avatar_url
    ? (chef.avatar_url.startsWith('/media') ? `${API_BASE}${chef.avatar_url}` : chef.avatar_url)
    : undefined;

  const bannerBg = chef.banner_url
    ? `url(${chef.banner_url.startsWith('/media') ? API_BASE + chef.banner_url : chef.banner_url}) center/cover no-repeat`
    : `linear-gradient(135deg, ${chef.avatar_color}cc, ${chef.avatar_color}55)`;

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: t.bgCard,
        border: `1px solid ${hov ? t.borderAcc : t.border}`,
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.18s, transform 0.18s, box-shadow 0.18s',
        transform: hov ? 'translateY(-4px)' : 'none',
        boxShadow: hov ? `0 12px 40px ${chef.avatar_color}22` : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={onClick}
    >
      {/* Banner — uses real banner_url if available, else colour gradient */}
      <div style={{ height: 88, background: bannerBg, position: 'relative', flexShrink: 0 }}>
        {/* dot texture overlay */}
        {!chef.banner_url && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '14px 14px' }} />}
        {/* featured badge */}
        {chef.featured && (
          <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', borderRadius: 99, padding: '2px 9px' }}>
            <span style={{ fontSize: 8, color: '#F59E0B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>★ Featured</span>
          </div>
        )}
        {chef.plan === 'pro' && (
          <div style={{ position: 'absolute', top: 10, right: 12, background: 'rgba(232,184,75,0.2)', border: '1px solid rgba(232,184,75,0.4)', borderRadius: 6, padding: '2px 7px', fontSize: 8, fontWeight: 800, color: '#E8B84B', letterSpacing: '0.08em' }}>PRO</div>
        )}
        {/* Avatar — 50% overlapping the banner bottom */}
        <div style={{ position: 'absolute', bottom: -24, left: 16 }}>
          {avatarUrl ? (
            <Avatar name={chef.name} color={chef.avatar_color} imageUrl={avatarUrl} size={52} radius={14} verified={chef.verified} verifiedColor={t.accent} verifiedBorder={t.bgCard} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 14, background: chef.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, border: `3px solid ${t.bgCard}`, position: 'relative' }}>
              👨‍🍳
              {chef.verified && (
                <div style={{ position: 'absolute', bottom: -3, right: -3, width: 16, height: 16, borderRadius: 99, background: t.accent, border: `2px solid ${t.bgCard}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff' }}>✓</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '32px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Name row: name/role left, like/dislike/msg right */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: t.textPrimary, margin: 0, fontFamily: 'Georgia, serif', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chef.name}</p>
            {chef.role && <p style={{ fontSize: 11, color: t.accent, margin: '2px 0 0', fontWeight: 600 }}>{chef.role}</p>}
            {chef.speciality && <p style={{ fontSize: 10, color: t.textSecondary, margin: '2px 0 0' }}>🍳 {chef.speciality}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {(chef.like_count ?? 0) > 0 && (
              <span style={{ fontSize: 10, color: '#22C55E', fontWeight: 700 }}>👍 {fmtN(chef.like_count ?? 0)}</span>
            )}
            {(chef.dislike_count ?? 0) > 0 && (
              <span style={{ fontSize: 10, color: t.textTertiary, fontWeight: 600 }}>👎 {fmtN(chef.dislike_count ?? 0)}</span>
            )}
            <button
              onClick={onMsg}
              title="Message chef"
              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = t.accent; (e.currentTarget as HTMLElement).style.color = t.accent; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = t.border; (e.currentTarget as HTMLElement).style.color = t.textSecondary; }}>
              💬
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stars rating={chef.rating} />
          <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>{chef.rating}</span>
          <span style={{ fontSize: 10, color: t.textTertiary }}>({chef.review_count})</span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: t.bgSurface, border: `1px solid ${t.border}`, color: t.textTertiary }}>🍳 {chef.recipe_count} recipes</span>
          {(chef.reel_count ?? chef.videos?.length ?? 0) > 0 && (
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: t.accentBg, border: `1px solid ${t.borderAcc}`, color: t.accent }}>▶ {chef.reel_count ?? chef.videos?.length} reels</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RECIPE CARD ──────────────────────────────────────────────────────────────
function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  const { t } = useChefTheme();
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: t.bgCard,
        border: `1px solid ${hov ? t.borderAcc : t.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.18s, transform 0.18s, box-shadow 0.18s',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? `0 10px 32px ${recipe.chef.avatar_color}18` : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Recipe hero */}
      <div style={{ height: 130, background: `linear-gradient(160deg,${recipe.chef.avatar_color}44,${recipe.chef.avatar_color}88)`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 72, opacity: hov ? 0.22 : 0.14, transform: hov ? 'scale(1.08)' : 'scale(1)', display: 'block', transition: 'all 0.2s' }}>{recipe.emoji}</span>
        <span style={{ position: 'absolute', fontSize: 52 }}>{recipe.emoji}</span>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.5) 100%)' }} />
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 5 }}>
          <span style={{ fontSize: 9, background: 'rgba(0,0,0,0.65)', color: '#F5EFE6', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>{recipe.cuisine}</span>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <span style={{ fontSize: 9, background: `${recipe.chef.avatar_color}bb`, color: '#fff', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>{recipe.difficulty}</span>
        </div>
        <div style={{ position: 'absolute', bottom: 8, right: 10 }}>
          <span style={{ fontSize: 9, background: 'rgba(0,0,0,0.65)', color: '#F5EFE6', padding: '2px 8px', borderRadius: 99 }}>⏱ {recipe.cook_time}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary, margin: 0, fontFamily: 'Georgia, serif', lineHeight: 1.25 }}>{recipe.title}</h3>
        <p style={{ fontSize: 11, color: t.textSecondary, margin: 0, lineHeight: 1.6, flex: 1 }}>
          {(recipe.description || '').slice(0, 72)}{(recipe.description || '').length > 72 ? '…' : ''}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${t.border}`, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar name={recipe.chef.name} color={recipe.chef.avatar_color} size={20} radius={5} />
            <span style={{ fontSize: 10, color: t.accent, fontWeight: 600 }}>{recipe.chef.name.split(' ')[0]}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: t.textTertiary }}>
            {recipe.like_count > 0 && <span>👍 {fmtN(recipe.like_count)}</span>}
            {recipe.comment_count > 0 && <span>💬 {recipe.comment_count}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, t }: { icon: string; title: string; subtitle?: string; t: any }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: t.accentBg, border: `1px solid ${t.borderAcc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: t.textPrimary, margin: 0, fontFamily: 'Georgia, serif', lineHeight: 1 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 11, color: t.textTertiary, margin: '2px 0 0' }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(90deg, ${t.borderAcc}, ${t.border}, transparent)`, marginTop: 12 }} />
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';

function _mapApiChef(c: any): Chef {
  return {
    id: c.id,
    name: c.name || '',
    slug: c.slug,
    role: c.designation || '',
    speciality: c.cuisine_speciality || '',
    location: c.location || '',
    rating: c.rating ?? null,
    review_count: c.review_count ?? 0,
    recipe_count: c.recipe_count ?? 0,
    reel_count: c.reel_count ?? 0,
    follower_count: c.follower_count ?? 0,
    like_count: c.like_count ?? 0,
    dislike_count: c.dislike_count ?? 0,
    verified: c.is_verified ?? false,
    featured: c.is_featured ?? false,
    avatar_color: c.avatar_color || '#DA7756',
    avatar_url: c.avatar_url ?? undefined,
    banner_url: c.banner_url ?? undefined,
    bio: c.bio ?? undefined,
    cuisine_tags: c.cuisine_tags ?? [],
    youtube_url: c.youtube_url ?? undefined,
    instagram_url: c.instagram_url ?? undefined,
    website_url: c.website_url ?? undefined,
    plan: (c.plan as 'free' | 'pro') ?? 'free',
    videos: [],
  };
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
function FindChefPage() {
  const { t } = useChefTheme();
  const router = useRouter();
  const bp = useBreakpoint();
  const isMob = bp === 'mobile';
  const isTab = bp === 'tablet';
  const isDesk = bp === 'desktop';

  const [query, setQuery] = useState('');
  const [followed, setFollowed] = useState<Record<number, boolean>>({});
  const [msgChef, setMsgChef] = useState<Chef | null>(null);
  const [activeVideo, setActiveVideo] = useState<{ video: ChefVideo; chef: Chef } | null>(null);
  const [openReel, setOpenReel] = useState<any | null>(null);
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);
  const [openApiRecipe, setOpenApiRecipe] = useState<any | null>(null);
  const [apiRecipeLikes, setApiRecipeLikes] = useState(0);
  const [apiRecipeDislikes, setApiRecipeDislikes] = useState(0);
  const [apiRecipeUserReaction, setApiRecipeUserReaction] = useState<'like'|'dislike'|null>(null);
  const [apiRecipeRating, setApiRecipeRating] = useState(0);
  const [apiRecipeAvgRating, setApiRecipeAvgRating] = useState<number|null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [chefs, setChefs] = useState<Chef[]>(MOCK_CHEFS);
  const [chefsLoaded, setChefsLoaded] = useState(false);
  const [apiReels, setApiReels] = useState<any[]>([]);
  const [apiRecipes, setApiRecipes] = useState<any[]>([]);

  const chefsRef = useRef<HTMLDivElement>(null);
  const reelsRef = useRef<HTMLDivElement>(null);
  const recipesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setUserType(localStorage.getItem('gharka_user_type')); } catch {}
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/chefs?per_page=50`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/chefs/reels/recent?per_page=20`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE}/chefs/recipes/recent?per_page=12`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([chefsData, reelsData, recipesData]) => {
      if (chefsData?.chefs?.length) setChefs((chefsData.chefs as any[]).map(_mapApiChef));
      if (reelsData?.reels?.length) setApiReels(reelsData.reels);
      if (recipesData?.recipes?.length) setApiRecipes(recipesData.recipes);
      setChefsLoaded(true);
    }).catch(() => setChefsLoaded(true));
  }, []);

  const filteredChefs = chefs.filter(c =>
    !query ||
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.speciality || '').toLowerCase().includes(query.toLowerCase()) ||
    (c.location || '').toLowerCase().includes(query.toLowerCase())
  );
  const allVideos = chefs.flatMap(c => (c.videos || []).map(v => ({ video: v, chef: c })));

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  function openApiRecipeModal(r: any) {
    setOpenApiRecipe(r);
    setApiRecipeLikes(r.like_count ?? 0);
    setApiRecipeDislikes(r.dislike_count ?? 0);
    setApiRecipeUserReaction(null);
    setApiRecipeRating(0);
    setApiRecipeAvgRating(null);
    if (r.recipe_key) {
      fetch(`${API_BASE}/recipes/${r.recipe_key}/view`, { method: 'POST' }).catch(() => {});
      const token = typeof window !== 'undefined' ? localStorage.getItem('gharka_token') : null;
      fetch(`${API_BASE}/recipes/${r.recipe_key}/reactions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(res => res.ok ? res.json() : null).then(data => {
        if (data) {
          setApiRecipeLikes(data.likes ?? 0);
          setApiRecipeDislikes(data.dislikes ?? 0);
          setApiRecipeUserReaction(data.user_reaction ?? null);
        }
      }).catch(() => {});
    }
  }

  function reactApiRecipe(action: 'like' | 'dislike') {
    const r = openApiRecipe;
    if (!r?.recipe_key) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('gharka_token') : null;
    if (!token) return;
    const newReaction = apiRecipeUserReaction === action ? null : action;
    const endpoint = newReaction === null ? `${API_BASE}/recipes/${r.recipe_key}/react` : `${API_BASE}/recipes/${r.recipe_key}/react`;
    const method = newReaction === null ? 'DELETE' : 'POST';
    fetch(endpoint, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: newReaction ? JSON.stringify({ action }) : undefined,
    }).then(res => res.ok ? res.json() : null).then(data => {
      if (data) { setApiRecipeLikes(data.likes ?? 0); setApiRecipeDislikes(data.dislikes ?? 0); }
    }).catch(() => {});
    setApiRecipeUserReaction(newReaction);
    if (newReaction === 'like') { setApiRecipeLikes(n => n + 1); if (apiRecipeUserReaction === 'dislike') setApiRecipeDislikes(n => n - 1); }
    else if (newReaction === 'dislike') { setApiRecipeDislikes(n => n + 1); if (apiRecipeUserReaction === 'like') setApiRecipeLikes(n => n - 1); }
    else { if (apiRecipeUserReaction === 'like') setApiRecipeLikes(n => n - 1); else setApiRecipeDislikes(n => n - 1); }
  }

  function rateApiRecipe(rating: number) {
    const r = openApiRecipe;
    if (!r?.recipe_key) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('gharka_token') : null;
    if (!token) return;
    setApiRecipeRating(rating);
    fetch(`${API_BASE}/recipes/${r.recipe_key}/review`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    }).then(res => res.ok ? res.json() : null).then(data => {
      if (data?.avg_rating) setApiRecipeAvgRating(data.avg_rating);
    }).catch(() => {});
  }

  // ── Responsive grid columns ─────────────────────────────────────────────
  // Chefs: 1 col mobile → 2 col tablet → 4 col desktop
  // Reels: 2 col mobile → 3 col tablet → 5 col desktop
  // Recipes: 1 col mobile → 2 col tablet → 4 col desktop
  const chefCols = isMob ? '1fr' : isTab ? 'repeat(2,1fr)' : 'repeat(4,1fr)';
  const reelCols = isMob ? 'repeat(2,1fr)' : isTab ? 'repeat(3,1fr)' : 'repeat(5,1fr)';
  const recipeCols = isMob ? '1fr' : isTab ? 'repeat(2,1fr)' : 'repeat(4,1fr)';

  const gutter = isMob ? '16px 16px 80px' : isTab ? '20px 24px 60px' : '24px 48px 60px';
  const maxW = isDesk ? 1320 : '100%';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: t.bg }}>

      {/* ══ APP BAR ══════════════════════════════════════════════════════ */}
      <div style={{ flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#1a1815', borderBottom: `1px solid rgba(212,184,150,0.08)`, zIndex: 100 }}>
        <button onClick={() => router.push('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', color: '#F5EFE6', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: '6px 10px 6px 2px', borderRadius: 8 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
          </svg>
          Chat
        </button>
        {!isMob && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#F5EFE6', letterSpacing: '-0.01em' }}>Chefsy</span>
            <span style={{ fontSize: 9, color: '#DA7756', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>AI Kitchen</span>
          </div>
        )}
        <ThemeToggle />
      </div>

      {/* ══ SCROLL AREA ══════════════════════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(160deg, #110e08 0%, #1e1710 45%, #120f09 100%)',
          padding: isMob ? '20px 16px 18px' : isTab ? '28px 32px 24px' : '40px 48px 32px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* subtle grid texture */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(218,119,86,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(218,119,86,0.04) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
          {/* glow orb — smaller */}
          <div style={{ position: 'absolute', top: -60, right: isMob ? -60 : 40, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(218,119,86,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: maxW, margin: '0 auto' }}>
            {/* headline + eyebrow on same line (desktop) / stacked (mobile) */}
            <div style={{ display: 'flex', flexDirection: isMob ? 'column' : 'row', alignItems: isMob ? 'flex-start' : 'center', gap: isMob ? 8 : 16, marginBottom: 12 }}>
              <h1 style={{ fontSize: isMob ? 22 : isTab ? 28 : 34, fontWeight: 900, color: '#F5EFE6', margin: 0, fontFamily: 'Georgia, serif', lineHeight: 1.15 }}>
                Find a Chef{' '}
                <span style={{ color: '#DA7756' }}>Near You</span>
              </h1>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(218,119,86,0.12)', border: '1px solid rgba(218,119,86,0.28)', borderRadius: 99, padding: '4px 12px', flexShrink: 0 }}>
                <span style={{ fontSize: 11 }}>📍</span>
                <span style={{ fontSize: 10, color: '#DA7756', fontWeight: 700, letterSpacing: '0.02em' }}>Verified chefs near you</span>
              </div>
            </div>

            <p style={{ fontSize: isMob ? 12 : 13, color: '#BCA98D', margin: '0 0 16px', lineHeight: 1.6, maxWidth: 520 }}>
              Browse verified chefs, watch cooking reels, explore recipes, and message them directly.
            </p>

            {/* Search + quick-jump row */}
            <div style={{ display: 'flex', flexDirection: isMob ? 'column' : 'row', gap: 10, alignItems: isMob ? 'stretch' : 'center', maxWidth: 800 }}>
              {/* search */}
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#7D6A52', pointerEvents: 'none', fontSize: 15 }}>🔍</span>
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search chef, cuisine, or location…"
                  style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 12, border: '1px solid rgba(212,184,150,0.15)', background: 'rgba(255,255,255,0.05)', color: '#F5EFE6', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', backdropFilter: 'blur(8px)' }}
                />
              </div>
              {/* jump pills */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {[{ label: '👨‍🍳 Chefs', ref: chefsRef }, { label: '🎬 Reels', ref: reelsRef }, { label: '🍳 Recipes', ref: recipesRef }].map(({ label, ref }) => (
                  <button key={label} onClick={() => scrollTo(ref)}
                    style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(212,184,150,0.2)', background: 'rgba(255,255,255,0.05)', color: '#BCA98D', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s', backdropFilter: 'blur(8px)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DA7756'; (e.currentTarget as HTMLElement).style.color = '#DA7756'; (e.currentTarget as HTMLElement).style.background = 'rgba(218,119,86,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,184,150,0.2)'; (e.currentTarget as HTMLElement).style.color = '#BCA98D'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── STATS BAR — below hero, above chef cards ──────────────────── */}
        {!isMob && (
          <div style={{ background: t.bgElevated || '#1a1815', borderBottom: `1px solid ${t.border}`, padding: isTab ? '12px 32px' : '12px 48px' }}>
            <div style={{ maxWidth: maxW, margin: '0 auto', display: 'flex', gap: isDesk ? 40 : 24 }}>
              {[
                [String(filteredChefs.length || chefs.length), 'Verified Chefs'],
                [String(apiRecipes.length || '—'), 'Recipes'],
                [String(apiReels.length || '—'), 'Video Reels'],
                ['4.7★', 'Avg Rating'],
              ].map(([val, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: isDesk ? 18 : 16, fontWeight: 800, color: '#F5EFE6', fontFamily: 'monospace' }}>{val}</span>
                  <span style={{ fontSize: 10, color: '#7D6A52', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PAGE BODY ─────────────────────────────────────────────────── */}
        <div style={{ padding: gutter, maxWidth: maxW, margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>

          {/* Chef dashboard banner */}
          {(userType === 'Chef' || userType === 'Restaurant/Foodcourt') && (
            <div style={{ background: `linear-gradient(135deg,${t.accentBg},${t.bgCard})`, border: `1px solid ${t.borderAcc}`, borderRadius: 16, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, margin: 0 }}>👨‍🍳 Chef Dashboard</p>
                <p style={{ fontSize: 12, color: t.textSecondary, margin: '4px 0 0' }}>Manage your profile, recipes, reels, and analytics.</p>
              </div>
              <Btn t={t} onClick={() => router.push('/chef-dashboard')}>Open Dashboard →</Btn>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 1 — CHEFS
              4 cards/row desktop · 2 tablet · 1 mobile
              ══════════════════════════════════════════════════════════════ */}
          <div ref={chefsRef} style={{ scrollMarginTop: 72, marginBottom: isDesk ? 36 : 28 }}>
            <SectionHeader icon="👨‍🍳" title="Our Chefs" subtitle={`${filteredChefs.length} verified chefs available`} t={t} />

            {filteredChefs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: t.textTertiary }}>
                <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 12 }}>🔍</div>
                <p style={{ fontSize: 14 }}>No chefs match your search</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: chefCols, gap: isMob ? 14 : isTab ? 16 : 20 }}>
                {filteredChefs.map(c => (
                  <ChefCard
                    key={c.id}
                    chef={c}
                    followed={followed[c.id] || false}
                    onFollow={() => setFollowed(f => ({ ...f, [c.id]: !f[c.id] }))}
                    onMsg={() => setMsgChef(c)}
                    onClick={() => router.push(`/chef/${c.slug}`)}
                    bp={bp}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${t.border},transparent)`, margin: `0 0 ${isDesk ? 36 : 28}px` }} />

          {/* ══════════════════════════════════════════════════════════════
              SECTION 2 — REELS
              5 cards/row desktop · 3 tablet · 2 mobile
              ══════════════════════════════════════════════════════════════ */}
          <div ref={reelsRef} style={{ scrollMarginTop: 72, marginBottom: isDesk ? 36 : 28 }}>
            <SectionHeader icon="🎬" title="Chef Reels" subtitle={`${apiReels.length} cooking videos`} t={t} />

            {apiReels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: t.textTertiary }}>
                <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 12 }}>🎬</div>
                <p style={{ fontSize: 14 }}>No reels yet</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: reelCols, gap: isMob ? 8 : isTab ? 10 : 12 }}>
                {apiReels.map((reel: any) => {
                  const isYt = reel.platform === 'youtube' || (reel.video_url || '').includes('youtube') || (reel.video_url || '').includes('youtu.be');
                  let ytId = '';
                  if (isYt && reel.video_url) {
                    try {
                      const u = new URL(reel.video_url);
                      if (u.hostname.includes('youtu.be')) {
                        ytId = u.pathname.slice(1).split('?')[0];
                      } else if (u.pathname.includes('/shorts/')) {
                        ytId = u.pathname.split('/shorts/')[1]?.split('?')[0] || '';
                      } else {
                        ytId = u.searchParams.get('v') || '';
                      }
                    } catch {}
                  }
                  const thumb = reel.thumbnail
                    ? (reel.thumbnail.startsWith('/') ? `${API_BASE}${reel.thumbnail}` : reel.thumbnail)
                    : ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
                    : reel.video_file_path ? `${API_BASE}${reel.video_file_path.replace(/\.[^.]+$/, '_thumb.jpg')}` : null;
                  return (
                    <div key={reel.id} onClick={() => setOpenReel(reel)}
                      style={{ position: 'relative', aspectRatio: '9/14', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${t.border}`, background: `linear-gradient(160deg,${reel.chef_avatar_color || '#DA7756'}55 0%,#111 100%)` }}>
                      {thumb
                        ? <img src={thumb} alt={reel.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, opacity: 0.3 }}>🎬</div>
                      }
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%,rgba(0,0,0,0.82))' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 12, color: '#fff', marginLeft: 3 }}>▶</span>
                      </div>
                      <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.65)', borderRadius: 99, padding: '2px 8px 2px 2px' }}>
                        <Avatar name={reel.chef_name || ''} color={reel.chef_avatar_color || '#DA7756'} size={16} radius={99} />
                        <span style={{ fontSize: 8, color: '#F5EFE6', fontWeight: 700 }}>{(reel.chef_name || '').split(' ')[0]}</span>
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 7px' }}>
                        <p style={{ fontSize: 9, color: '#fff', margin: '0 0 2px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reel.title}</p>
                        {reel.view_count > 0 && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>👁 {reel.view_count}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${t.border},transparent)`, marginBottom: isDesk ? 36 : 28 }} />

          {/* ══════════════════════════════════════════════════════════════
              SECTION 3 — RECIPES
              4 cards/row desktop · 2 tablet · 1 mobile
              ══════════════════════════════════════════════════════════════ */}
          <div ref={recipesRef} style={{ scrollMarginTop: 72, marginBottom: isDesk ? 36 : 28 }}>
            <SectionHeader icon="🍳" title="Popular Recipes" subtitle={`${apiRecipes.length || MOCK_RECIPES.length} handpicked recipes`} t={t} />
            {apiRecipes.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: recipeCols, gap: isMob ? 14 : isTab ? 16 : 20 }}>
                {apiRecipes.map((r: any) => {
                  const diffColor: Record<string, string> = { Easy: '#10B981', Moderate: '#F59E0B', Hard: '#EF4444', Expert: '#8B5CF6' };
                  const dc = diffColor[r.difficulty] || '#888';
                  return (
                    <div key={r.id} onClick={() => openApiRecipeModal(r)}
                      style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = t.accent)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = t.border)}>
                      <div style={{ height: 120, background: r.image_url ? `url(${r.image_url}) center/cover` : `linear-gradient(135deg,${r.chef_avatar_color || '#DA7756'}44,${r.chef_avatar_color || '#DA7756'}22)`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {!r.image_url && <span style={{ fontSize: 40, opacity: 0.2 }}>🍳</span>}
                        {r.difficulty && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${dc}22`, color: dc, border: `1px solid ${dc}44` }}>{r.difficulty}</div>}
                      </div>
                      <div style={{ padding: '10px 13px 13px' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          {r.cuisine && <span style={{ fontSize: 10, color: t.textTertiary }}>🍽 {r.cuisine}</span>}
                          {r.cook_time && <span style={{ fontSize: 10, color: t.textTertiary }}>⏱ {r.cook_time}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                          <Avatar name={r.chef_name || ''} color={r.chef_avatar_color || '#DA7756'} size={20} radius={6} />
                          <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.chef_name}</span>
                          {r.like_count > 0 && <span style={{ fontSize: 10, color: '#22C55E' }}>👍 {r.like_count}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: recipeCols, gap: isMob ? 14 : isTab ? 16 : 20 }}>
                {MOCK_RECIPES.map(r => (
                  <RecipeCard key={r.id} recipe={r} onClick={() => setOpenRecipe(r)} />
                ))}
              </div>
            )}
          </div>

          {/* ── JOIN CTA ──────────────────────────────────────────────── */}
          <div style={{
            marginTop: 12,
            padding: isMob ? '28px 24px' : '40px 56px',
            background: 'linear-gradient(135deg, rgba(218,119,86,0.12) 0%, rgba(218,119,86,0.04) 100%)',
            border: `1px solid ${t.borderAcc}`,
            borderRadius: 24,
            display: 'flex',
            flexDirection: isMob ? 'column' : 'row',
            alignItems: isMob ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: 24,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(218,119,86,0.1) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: isMob ? 20 : 24, fontWeight: 900, color: t.textPrimary, margin: '0 0 8px', fontFamily: 'Georgia, serif' }}>Are you a chef? ✨</p>
              <p style={{ fontSize: 13, color: t.textSecondary, margin: 0, lineHeight: 1.6, maxWidth: 420 }}>
                Join Chefsy, share your recipes and reels, and connect with thousands of food lovers near you.
              </p>
            </div>
            <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
              <Btn t={t} size="lg" onClick={() => router.push('/chef-dashboard')}>Join as a Chef →</Btn>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {openReel && <ReelVideoModal reel={openReel} onClose={() => setOpenReel(null)} />}
      {activeVideo && <VideoModal video={activeVideo.video} chef={activeVideo.chef} onClose={() => setActiveVideo(null)} />}
      {msgChef && <MessageSheet chef={msgChef} onClose={() => setMsgChef(null)} />}
      {openRecipe && <RecipeModal recipe={openRecipe} onClose={() => setOpenRecipe(null)} bp={bp} />}

      {/* API Recipe detail modal */}
      {openApiRecipe && (() => {
        const r = openApiRecipe;
        const dc: Record<string, string> = { Easy: '#10B981', Moderate: '#F59E0B', Hard: '#EF4444', Expert: '#8B5CF6' };
        const accent = r.chef_avatar_color || '#DA7756';
        const ings: { name: string; quantity?: string; unit?: string }[] = r.ingredients || [];
        const steps: string[] = r.steps || [];
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: isMob ? 'flex-end' : 'center', justifyContent: 'center', padding: isMob ? 0 : 16 }}
            onClick={e => e.target === e.currentTarget && (setOpenApiRecipe(null), setApiRecipeUserReaction(null))}
          >
            <div style={{ width: '100%', maxWidth: isMob ? '100%' : 600, maxHeight: isMob ? '94vh' : '90vh', background: t.bg, borderRadius: isMob ? '24px 24px 0 0' : 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${t.border}`, boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

              {/* Hero */}
              <div style={{ flexShrink: 0, height: isMob ? 170 : 210, background: r.image_url ? `url(${r.image_url}) center/cover` : `linear-gradient(135deg,${accent}55,${accent}22)`, position: 'relative' }}>
                {!r.image_url && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, opacity: 0.12 }}>🍳</div>}
                <button onClick={() => { setOpenApiRecipe(null); setApiRecipeUserReaction(null); }} style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 10, border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', fontFamily: 'inherit' }}>✕</button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '28px 16px 14px', background: 'linear-gradient(transparent,rgba(0,0,0,0.78))' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {r.cuisine && <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.6)', color: '#F5EFE6', padding: '2px 9px', borderRadius: 99, fontWeight: 600 }}>{r.cuisine}</span>}
                    {r.difficulty && <span style={{ fontSize: 10, background: `${dc[r.difficulty] || '#888'}99`, color: '#fff', padding: '2px 9px', borderRadius: 99, fontWeight: 700 }}>{r.difficulty}</span>}
                    {r.cook_time && <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.6)', color: '#F5EFE6', padding: '2px 9px', borderRadius: 99 }}>⏱ {r.cook_time}</span>}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 32px' }}>

                {/* Title */}
                <h2 style={{ fontSize: isMob ? 19 : 22, fontWeight: 900, color: t.textPrimary, margin: '0 0 14px', fontFamily: 'Georgia, serif', lineHeight: 1.2 }}>{r.title}</h2>

                {/* Chef row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: `1px solid ${t.border}`, marginBottom: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: r.chef_avatar_color || '#DA7756', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👨‍🍳</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary, margin: 0 }}>{r.chef_name}</p>
                    <button onClick={() => { setOpenApiRecipe(null); router.push(`/chef/${r.chef_slug}`); }} style={{ fontSize: 10, color: accent, margin: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>View Profile →</button>
                  </div>
                </div>

                {/* Like / Dislike / Rating row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <button onClick={() => reactApiRecipe('like')}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${apiRecipeUserReaction === 'like' ? '#22C55E' : t.border}`, background: apiRecipeUserReaction === 'like' ? 'rgba(34,197,94,0.12)' : 'transparent', color: apiRecipeUserReaction === 'like' ? '#22C55E' : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={apiRecipeUserReaction === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                    Like{apiRecipeLikes > 0 ? ` ${fmtN(apiRecipeLikes)}` : ''}
                  </button>
                  <button onClick={() => reactApiRecipe('dislike')}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${apiRecipeUserReaction === 'dislike' ? '#EF4444' : t.border}`, background: apiRecipeUserReaction === 'dislike' ? 'rgba(239,68,68,0.1)' : 'transparent', color: apiRecipeUserReaction === 'dislike' ? '#EF4444' : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                    👎 {fmtN(apiRecipeDislikes)}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={() => rateApiRecipe(star)}
                        style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', color: star <= apiRecipeRating ? '#F59E0B' : t.textTertiary, padding: '0 1px', transition: 'color 0.1s' }}>
                        {star <= apiRecipeRating ? '★' : '☆'}
                      </button>
                    ))}
                    {apiRecipeAvgRating && <span style={{ fontSize: 10, color: t.textTertiary, marginLeft: 4 }}>avg {apiRecipeAvgRating.toFixed(1)}</span>}
                  </div>
                </div>

                {/* Description */}
                {r.description && (
                  <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.8, margin: '0 0 22px' }}>{r.description}</p>
                )}

                {/* Ingredients */}
                {ings.length > 0 && (
                  <div style={{ marginBottom: 22 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>🧂 Ingredients</p>
                    <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : 'repeat(2,1fr)', gap: 6 }}>
                      {ings.map((ing, i) => (
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

                {/* Steps */}
                {steps.length > 0 && (
                  <div style={{ marginBottom: 22 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>📋 Preparation Steps</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {steps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 14px', background: t.bgCard, borderRadius: 11, border: `1px solid ${t.border}` }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, background: t.accentBg, border: `1px solid ${t.borderAcc}`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                          <p style={{ fontSize: 13, color: t.textPrimary, margin: 0, lineHeight: 1.65, flex: 1 }}>{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {r.tips && (
                  <div style={{ marginBottom: 22 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>💡 Chef's Tips</p>
                    <div style={{ padding: '13px 16px', background: `${accent}12`, border: `1px solid ${accent}30`, borderRadius: 12 }}>
                      <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.75, margin: 0 }}>{r.tips}</p>
                    </div>
                  </div>
                )}

                {/* Hashtags */}
                {(r.hashtags?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(r.hashtags as string[]).map((tag, i) => (
                      <span key={i} style={{ fontSize: 11, color: t.accent, background: t.accentBg, border: `1px solid ${t.borderAcc}`, borderRadius: 99, padding: '3px 10px', fontWeight: 600 }}>
                        {tag.startsWith('#') ? tag : `#${tag}`}
                      </span>
                    ))}
                  </div>
                )}

                {/* Fallback */}
                {!r.description && !ings.length && !steps.length && !r.tips && (
                  <p style={{ fontSize: 13, color: t.textTertiary }}>No details available yet.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function FindChefPageWrapper() {
  return (
    <ChefThemeProvider>
      <FindChefPage />
    </ChefThemeProvider>
  );
}
