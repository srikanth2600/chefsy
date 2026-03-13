'use client';
/**
 * Dashboard  /adminpanel
 * APIs needed:
 *   GET /admin/stats      → { users_total, users_new_7d, recipes_total, recipes_cached_pct,
 *                             videos_total, videos_pending, chats_total, chats_today,
 *                             likes_total, revenue_mtd }
 *   GET /admin/activity   → { items: [{ type, message, created_at }] }
 *   GET /admin/top-recipes → { items: [{ title, likes, chats }] }
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type Stats = {
  users_total: number; users_new_7d: number;
  recipes_total: number; recipes_cached_pct: number;
  videos_total: number; videos_pending: number;
  chats_total: number; chats_today: number;
  likes_total: number;
};
type ActivityItem = { type: string; message: string; created_at: string };
type TopRecipe    = { title: string; likes: number; chats: number };

const DOT_COLOR: Record<string, string> = {
  user: 'var(--abl)', recipe: 'var(--acc)', video: 'var(--ag)',
  chat: 'var(--ap)', feedback: 'var(--ay)', default: 'var(--at3)',
};

// Fake sparkline data for CSS bars (replace with real 7-day data from API)
const BARS = [30, 55, 40, 70, 60, 85, 100];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [topRecipes, setTopRecipes] = useState<TopRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    Promise.all([
      fetch(`${API}/admin/stats`,       { headers: hdr() }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/admin/activity`,    { headers: hdr() }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/admin/top-recipes`, { headers: hdr() }).then(r => r.ok ? r.json() : null),
    ])
      .then(([s, a, t]) => {
        if (s) setStats(s);
        if (a?.items) setActivity(a.items.slice(0, 8));
        if (t?.items) setTopRecipes(t.items.slice(0, 5));
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statCards = [
    { color: 'c-orange', icon: '◎', label: 'Total Users',     value: stats?.users_total,     delta: `+${stats?.users_new_7d ?? 0} this week`, trend: 'up' },
    { color: 'c-blue',   icon: '🍳', label: 'Recipes Cached',  value: stats?.recipes_total,   delta: `${stats?.recipes_cached_pct ?? 0}% cached`, trend: 'flat' },
    { color: 'c-green',  icon: '▶', label: 'Videos',           value: stats?.videos_total,    delta: `${stats?.videos_pending ?? 0} pending review`, trend: 'flat' },
    { color: 'c-purple', icon: '◻', label: 'Chats Today',      value: stats?.chats_today,     delta: `${stats?.chats_total ?? 0} total`, trend: 'up' },
    { color: 'c-yellow', icon: '✦', label: 'Total Likes',      value: stats?.likes_total,     delta: 'across all recipes', trend: 'up' },
    { color: 'c-red',    icon: '◈', label: 'Videos Pending',   value: stats?.videos_pending,  delta: 'awaiting review', trend: stats?.videos_pending ? 'down' : 'flat' },
  ];

  return (
    <>
      {/* Page header */}
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Dashboard</div>
          <div className="adm-ph-sub">Overview of all platform activity</div>
        </div>
        <div className="adm-ph-actions">
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => window.location.reload()}>
            ↺ Refresh
          </button>
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => router.push('/adminpanel/analytics')}>
            View Analytics →
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 16, fontSize: 13 }}>
          ⚠ Could not load stats — {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="adm-stats">
        {statCards.map((s, i) => (
          <div key={i} className={`adm-stat ${s.color}`}>
            <div className="adm-stat-icon">{s.icon}</div>
            <div className="adm-stat-val">
              {loading ? <span className="adm-sk" style={{ display: 'block', height: 28, width: 60 }} /> : (s.value ?? '—')}
            </div>
            <div className="adm-stat-label">{s.label}</div>
            <div className={`adm-stat-delta ${s.trend}`}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Two column: chart + activity */}
      <div className="adm-grid2 adm-mb3" style={{ gap: 14 }}>

        {/* Chat volume sparkline */}
        <div className="adm-card">
          <div className="adm-card-hd">
            <span className="adm-card-title">◻ Chat Volume — Last 7 Days</span>
            <span style={{ fontSize: 11, color: 'var(--at3)' }}>Daily chats</span>
          </div>
          <div className="adm-card-bd">
            <div className="adm-bars">
              {BARS.map((h, i) => (
                <div key={i} className={`adm-bar${i === BARS.length - 1 ? ' hi' : ''}`} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="adm-row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--at3)' }}>Mon</span>
              <span style={{ fontSize: 11, color: 'var(--at3)' }}>Sun</span>
            </div>
            <div style={{ borderTop: '1px solid var(--ae)', marginTop: 12, paddingTop: 12, display: 'flex', gap: 20 }}>
              {[['Total Chats', stats?.chats_total ?? '…'], ['Today', stats?.chats_today ?? '…'], ['Avg/day', stats?.chats_total ? Math.round(stats.chats_total / 7) : '…']].map(([l, v]) => (
                <div key={String(l)}>
                  <div style={{ fontSize: 18, fontFamily: 'var(--fd)', fontWeight: 700, color: 'var(--at)' }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--at3)' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="adm-card">
          <div className="adm-card-hd">
            <span className="adm-card-title">✦ Recent Activity</span>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => router.push('/adminpanel/chats')}>
              View all
            </button>
          </div>
          <div className="adm-card-bd" style={{ padding: '8px 18px' }}>
            {loading ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="adm-act-item">
                <div className="adm-sk" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="adm-sk adm-mb1" style={{ height: 12, width: '80%' }} />
                  <div className="adm-sk" style={{ height: 10, width: '40%' }} />
                </div>
              </div>
            )) : activity.length === 0 ? (
              <div className="adm-empty" style={{ padding: '24px 0' }}>
                <div className="adm-empty-icon">✦</div>
                <div className="adm-empty-title">No recent activity</div>
              </div>
            ) : activity.map((item, i) => (
              <div key={i} className="adm-act-item">
                <div className="adm-act-dot" style={{ background: DOT_COLOR[item.type] ?? DOT_COLOR.default }} />
                <div>
                  <div className="adm-act-txt" dangerouslySetInnerHTML={{ __html: item.message }} />
                  <div className="adm-act-time">{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top recipes + quick actions */}
      <div className="adm-grid2" style={{ gap: 14 }}>

        {/* Top recipes */}
        <div className="adm-card">
          <div className="adm-card-hd">
            <span className="adm-card-title">🍳 Top Recipes by Likes</span>
            <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => router.push('/adminpanel/recipes')}>All recipes</button>
          </div>
          <div className="adm-card-bd" style={{ padding: '6px 18px 14px' }}>
            {(loading ? Array(5).fill({ title: '', likes: 0, chats: 0 }) : topRecipes).map((r, i) => {
              const max = topRecipes[0]?.likes || 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 4 ? '1px solid var(--ae)' : 'none' }}>
                  <span style={{ width: 18, fontSize: 11, color: 'var(--at3)', fontFamily: 'var(--fm)', flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
                  {loading ? (
                    <div className="adm-sk" style={{ flex: 1, height: 13 }} />
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--at)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                      <div style={{ width: 80 }}>
                        <div className="adm-prog-wrap">
                          <div className="adm-prog-bar" style={{ width: `${Math.round((r.likes / max) * 100)}%` }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--at3)', fontFamily: 'var(--fm)', width: 28, textAlign: 'right' }}>{r.likes}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="adm-card">
          <div className="adm-card-hd">
            <span className="adm-card-title">⚡ Quick Actions</span>
          </div>
          <div className="adm-card-bd">
            {[
              { label: 'Review Pending Videos',  color: 'adm-btn-warn',    href: '/adminpanel/videos',    icon: '▶', count: stats?.videos_pending },
              { label: 'Manage Users',            color: 'adm-btn-info',    href: '/adminpanel/users',     icon: '◎' },
              { label: 'View Chat Logs',          color: 'adm-btn-ghost',   href: '/adminpanel/chats',     icon: '◻' },
              { label: 'Browse Recipes',          color: 'adm-btn-ghost',   href: '/adminpanel/recipes',   icon: '🍳' },
              { label: 'Check Feedback',          color: 'adm-btn-success', href: '/adminpanel/feedback',  icon: '✦' },
              { label: 'Manage Ads',              color: 'adm-btn-ghost',   href: '/adminpanel/ads',       icon: '◈' },
            ].map(a => (
              <button key={a.href}
                className={`adm-btn ${a.color} adm-between adm-mb1`}
                style={{ width: '100%', justifyContent: 'space-between', textAlign: 'left' }}
                onClick={() => router.push(a.href)}
              >
                <span>{a.icon} {a.label}</span>
                {a.count != null && a.count > 0 && (
                  <span style={{ background: 'var(--ar)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>{a.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
