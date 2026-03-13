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
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${liked ? t.accent : t.border}`, background: liked ? t.accentBg : 'transparent', color: liked ? t.accent : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                {liked ? '♥' : '♡'} {fmtN(likes)}
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
function ChefCard({ chef, followed, onFollow, onMsg, onClick, bp }: {
  chef: Chef; followed: boolean;
  onFollow: () => void; onMsg: () => void; onClick: () => void; bp: BP;
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
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: t.textPrimary, margin: 0, fontFamily: 'Georgia, serif', lineHeight: 1.2 }}>{chef.name}</p>
          <p style={{ fontSize: 11, color: t.accent, margin: '2px 0 0', fontWeight: 600 }}>{chef.role}</p>
          {chef.speciality && <p style={{ fontSize: 10, color: t.textSecondary, margin: '2px 0 0' }}>🍳 {chef.speciality}</p>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stars rating={chef.rating} />
          <span style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>{chef.rating}</span>
          <span style={{ fontSize: 10, color: t.textTertiary }}>({chef.review_count})</span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: t.bgSurface, border: `1px solid ${t.border}`, color: t.textTertiary }}>🍳 {chef.recipe_count} recipes</span>
          {(chef.videos?.length ?? 0) > 0 && (
            <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: t.accentBg, border: `1px solid ${t.borderAcc}`, color: t.accent }}>▶ {chef.videos!.length} reels</span>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: t.textPrimary, margin: 0, fontFamily: 'monospace' }}>{fmtN(chef.follower_count)}</p>
            <p style={{ fontSize: 9, color: t.textTertiary, margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>followers</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={onFollow}
              style={{ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${followed ? t.accent : t.border}`, background: followed ? t.accentBg : 'transparent', color: followed ? t.accent : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {followed ? '✓' : '+'}
            </button>
            <button
              onClick={onMsg}
              style={{ padding: '6px 14px', borderRadius: 99, border: 'none', background: `linear-gradient(135deg,${t.accent},${t.accentHov})`, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
              Msg
            </button>
          </div>
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
            <span>♥ {fmtN(recipe.like_count)}</span>
            <span>💬 {recipe.comment_count}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, t }: { icon: string; title: string; subtitle?: string; t: any }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: t.accentBg, border: `1px solid ${t.borderAcc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: t.textPrimary, margin: 0, fontFamily: 'Georgia, serif', lineHeight: 1 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 12, color: t.textTertiary, margin: '3px 0 0' }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ height: 1, background: `linear-gradient(90deg, ${t.borderAcc}, ${t.border}, transparent)`, marginTop: 16 }} />
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';

function _mapApiChef(c: any): Chef {
  return {
    id: c.id,
    name: c.name || '',
    slug: c.slug,
    role: c.designation || 'Chef',
    speciality: c.cuisine_speciality || '',
    location: c.location || '',
    rating: c.rating ?? null,
    review_count: c.review_count ?? 0,
    recipe_count: c.recipe_count ?? 0,
    follower_count: c.follower_count ?? 0,
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
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null);
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

  // ── Responsive grid columns ─────────────────────────────────────────────
  // Chefs: 1 col mobile → 2 col tablet → 4 col desktop
  // Reels: 2 col mobile → 3 col tablet → 5 col desktop
  // Recipes: 1 col mobile → 2 col tablet → 4 col desktop
  const chefCols = isMob ? '1fr' : isTab ? 'repeat(2,1fr)' : 'repeat(4,1fr)';
  const reelCols = isMob ? 'repeat(2,1fr)' : isTab ? 'repeat(3,1fr)' : 'repeat(5,1fr)';
  const recipeCols = isMob ? '1fr' : isTab ? 'repeat(2,1fr)' : 'repeat(4,1fr)';

  const gutter = isMob ? '20px 16px 80px' : isTab ? '28px 24px 60px' : '36px 48px 60px';
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
          padding: isMob ? '32px 20px 28px' : isTab ? '44px 32px 36px' : '56px 48px 44px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* subtle grid texture */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(218,119,86,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(218,119,86,0.04) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
          {/* glow orb */}
          <div style={{ position: 'absolute', top: -80, right: isMob ? -80 : 60, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle,rgba(218,119,86,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: maxW, margin: '0 auto' }}>
            {/* eyebrow */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(218,119,86,0.12)', border: '1px solid rgba(218,119,86,0.28)', borderRadius: 99, padding: '5px 14px', marginBottom: 18 }}>
              <span style={{ fontSize: 12 }}>📍</span>
              <span style={{ fontSize: 11, color: '#DA7756', fontWeight: 700, letterSpacing: '0.02em' }}>Verified chefs near you</span>
            </div>

            {/* headline */}
            <h1 style={{ fontSize: isMob ? 30 : isTab ? 42 : 52, fontWeight: 900, color: '#F5EFE6', margin: '0 0 14px', fontFamily: 'Georgia, serif', lineHeight: 1.1, maxWidth: 640 }}>
              Find a Chef{' '}
              <span style={{ color: '#DA7756', display: 'inline' }}>Near You</span>
            </h1>
            <p style={{ fontSize: isMob ? 13 : 15, color: '#BCA98D', margin: '0 0 28px', lineHeight: 1.7, maxWidth: 480 }}>
              Browse verified chefs, watch their cooking reels, explore recipes, and message them directly.
            </p>

            {/* Search + quick jump row */}
            <div style={{ display: 'flex', flexDirection: isMob ? 'column' : 'row', gap: 12, alignItems: isMob ? 'stretch' : 'center', maxWidth: 720 }}>
              {/* search */}
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#7D6A52', pointerEvents: 'none', fontSize: 16 }}>🔍</span>
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search chef, cuisine, or location…"
                  style={{ width: '100%', padding: '13px 16px 13px 44px', borderRadius: 14, border: '1px solid rgba(212,184,150,0.15)', background: 'rgba(255,255,255,0.05)', color: '#F5EFE6', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', backdropFilter: 'blur(8px)' }}
                />
              </div>
              {/* jump pills */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {[{ label: '👨‍🍳 Chefs', ref: chefsRef }, { label: '🎬 Reels', ref: reelsRef }, { label: '🍳 Recipes', ref: recipesRef }].map(({ label, ref }) => (
                  <button key={label} onClick={() => scrollTo(ref)}
                    style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(212,184,150,0.2)', background: 'rgba(255,255,255,0.05)', color: '#BCA98D', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s', backdropFilter: 'blur(8px)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#DA7756'; (e.currentTarget as HTMLElement).style.color = '#DA7756'; (e.currentTarget as HTMLElement).style.background = 'rgba(218,119,86,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(212,184,150,0.2)'; (e.currentTarget as HTMLElement).style.color = '#BCA98D'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats row — desktop only */}
            {!isMob && (
              <div style={{ display: 'flex', gap: isDesk ? 40 : 24, marginTop: 32, paddingTop: 28, borderTop: '1px solid rgba(212,184,150,0.08)' }}>
                {[['5', 'Verified Chefs'], ['8', 'Recipes'], [String(allVideos.length), 'Video Reels'], ['4.7★', 'Avg Rating']].map(([val, label]) => (
                  <div key={label}>
                    <p style={{ fontSize: isDesk ? 26 : 20, fontWeight: 900, color: '#F5EFE6', margin: 0, fontFamily: 'monospace' }}>{val}</p>
                    <p style={{ fontSize: 11, color: '#7D6A52', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── PAGE BODY ─────────────────────────────────────────────────── */}
        <div style={{ padding: gutter, maxWidth: maxW, margin: '0 auto', boxSizing: 'border-box', width: '100%' }}>

          {/* Chef dashboard banner */}
          {(userType === 'Chef' || userType === 'Restaurant/Foodcourt') && (
            <div style={{ background: `linear-gradient(135deg,${t.accentBg},${t.bgCard})`, border: `1px solid ${t.borderAcc}`, borderRadius: 16, padding: '16px 20px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
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
          <div ref={chefsRef} style={{ scrollMarginTop: 72, marginBottom: isDesk ? 56 : 40 }}>
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
          <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${t.border},transparent)`, margin: `${isDesk ? 0 : 0}px 0 ${isDesk ? 56 : 40}px` }} />

          {/* ══════════════════════════════════════════════════════════════
              SECTION 2 — REELS
              5 cards/row desktop · 3 tablet · 2 mobile
              ══════════════════════════════════════════════════════════════ */}
          <div ref={reelsRef} style={{ scrollMarginTop: 72, marginBottom: isDesk ? 56 : 40 }}>
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
                    try { const u = new URL(reel.video_url); ytId = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : (u.searchParams.get('v') || ''); } catch {}
                  }
                  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
                    : reel.thumbnail ? (reel.thumbnail.startsWith('/') ? `${API_BASE}${reel.thumbnail}` : reel.thumbnail)
                    : null;
                  return (
                    <div key={reel.id} onClick={() => router.push(`/chef/${reel.chef_slug}`)}
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
          <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${t.border},transparent)`, marginBottom: isDesk ? 56 : 40 }} />

          {/* ══════════════════════════════════════════════════════════════
              SECTION 3 — RECIPES
              4 cards/row desktop · 2 tablet · 1 mobile
              ══════════════════════════════════════════════════════════════ */}
          <div ref={recipesRef} style={{ scrollMarginTop: 72, marginBottom: isDesk ? 56 : 40 }}>
            <SectionHeader icon="🍳" title="Popular Recipes" subtitle={`${apiRecipes.length || MOCK_RECIPES.length} handpicked recipes`} t={t} />
            {apiRecipes.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: recipeCols, gap: isMob ? 14 : isTab ? 16 : 20 }}>
                {apiRecipes.map((r: any) => {
                  const diffColor: Record<string, string> = { Easy: '#10B981', Moderate: '#F59E0B', Hard: '#EF4444', Expert: '#8B5CF6' };
                  const dc = diffColor[r.difficulty] || '#888';
                  return (
                    <div key={r.id} onClick={() => router.push(`/chef/${r.chef_slug}`)}
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
                          <span style={{ fontSize: 10, color: '#F59E0B' }}>♥ {r.like_count}</span>
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
      {activeVideo && <VideoModal video={activeVideo.video} chef={activeVideo.chef} onClose={() => setActiveVideo(null)} />}
      {msgChef && <MessageSheet chef={msgChef} onClose={() => setMsgChef(null)} />}
      {openRecipe && <RecipeModal recipe={openRecipe} onClose={() => setOpenRecipe(null)} bp={bp} />}
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
