'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChefTheme } from '@/components/chef/ChefThemeContext';
import { Btn, SLabel, Card, Pill, fmtN, ThemeToggle } from '@/components/chef/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

// Mock analytics data (replace with GET /chef/analytics?days=30)
const OVERVIEW = { total_views: 4760, total_likes: 803, total_followers: 1840, total_comments: 47, view_change: 18, like_change: 12, follower_change: 6 };
const RECIPE_STATS = [
  { title: 'Dum Biryani', views: 2840, likes: 521, comments: 18, completion: 72 },
  { title: 'Haleem', views: 1240, likes: 188, comments: 14, completion: 65 },
  { title: 'Mirchi ka Salan', views: 680, likes: 94, comments: 15, completion: 58 },
];
const CHART_DATA = [420, 310, 550, 480, 620, 590, 680, 720, 810, 760, 890, 940, 880, 1020]; // last 14 days

function AnalyticsPage() {
  const { t } = useChefTheme();
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    const tok = (() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } })();
    if (!tok) return;
    const h = { Authorization: `Bearer ${tok}` };
    fetch(`${API}/chefs/me/profile`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.plan === 'pro') setIsPro(true); }).catch(() => {});
    fetch(`${API}/chefs/me/analytics`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAnalytics(d); }).catch(() => {});
  }, []);

  if (!isPro) {
    return (
      <div style={{ minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📊</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: t.textPrimary, margin: '0 0 8px', fontFamily: 'Georgia, serif' }}>Analytics is a Pro Feature</h2>
          <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7, marginBottom: 20 }}>
            Upgrade to Pro to unlock detailed view charts, recipe performance stats, follower growth graphs and audience insights.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Btn variant="ghost" t={t} onClick={() => router.push('/chef-dashboard')}>← Dashboard</Btn>
            <Btn t={t}>✦ Upgrade to Pro</Btn>
          </div>
          {/* Blurred preview */}
          <div style={{ marginTop: 28, filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
            <div style={{ background: t.bgCard, borderRadius: 12, padding: '14px', marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[['👁', '4.8k', 'Views'], ['♥', '803', 'Likes'], ['👥', '1.8k', 'Followers'], ['💬', '47', 'Comments']].map(([ic, v, l]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16 }}>{ic}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: t.accent, fontFamily: 'monospace' }}>{v}</div>
                    <div style={{ fontSize: 9, color: t.textTertiary, textTransform: 'uppercase' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: t.bgCard, borderRadius: 12, padding: '14px', height: 80 }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Pro analytics UI ──────────────────────────────────────────────────────
  const maxVal = Math.max(...CHART_DATA);

  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 18px 80px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.push('/chef-dashboard')} style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>←</button>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: t.textPrimary, margin: 0 }}>Analytics</h1>
              <p style={{ fontSize: 11, color: t.textTertiary, margin: 0 }}>Last {days} days</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <ThemeToggle />
            {([7, 30, 90] as const).map((d) => (
              <button key={d} onClick={() => setDays(d)} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${days === d ? t.borderAcc : t.border}`, background: days === d ? t.accentBg : 'transparent', color: days === d ? t.accent : t.textSecondary, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: days === d ? 700 : 400 }}>{d}d</button>
            ))}
          </div>
        </div>

        {/* Overview cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { icon: '👁', value: fmtN(OVERVIEW.total_views), label: 'Total Views', change: OVERVIEW.view_change, color: t.accent },
            { icon: '♥', value: fmtN(OVERVIEW.total_likes), label: 'Total Likes', change: OVERVIEW.like_change, color: '#F59E0B' },
            { icon: '👥', value: fmtN(OVERVIEW.total_followers), label: 'Followers', change: OVERVIEW.follower_change, color: '#60A5FA' },
            { icon: '💬', value: String(OVERVIEW.total_comments), label: 'Comments', change: 8, color: '#A78BFA' },
          ].map((s) => (
            <Card key={s.label} t={t} style={{ border: `1px solid ${s.color}22` }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'monospace', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              <div style={{ fontSize: 10, color: t.success, marginTop: 4, fontWeight: 600 }}>↑ {s.change}% vs last period</div>
            </Card>
          ))}
        </div>

        {/* Views Chart */}
        <Card t={t} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 14px' }}>📈 Views Over Time</p>
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 80 }}>
            {CHART_DATA.map((v, i) => (
              <div key={i} title={`${v} views`} style={{ flex: 1, height: `${(v / maxVal) * 100}%`, background: `linear-gradient(to top,${t.accent},${t.accent}88)`, borderRadius: '3px 3px 0 0', cursor: 'pointer', transition: 'opacity 0.15s', minWidth: 4 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: t.textTertiary, marginTop: 5 }}>
            <span>{days} days ago</span><span>Today</span>
          </div>
        </Card>

        {/* Recipe Performance */}
        <Card t={t} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 14px' }}>🍳 Recipe Performance</p>
          {RECIPE_STATS.map((r) => (
            <div key={r.title} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, margin: 0 }}>{r.title}</p>
                <div style={{ display: 'flex', gap: 10, fontSize: 10, color: t.textTertiary }}>
                  <span>👁 {fmtN(r.views)}</span>
                  <span>♥ {r.likes}</span>
                  <span>💬 {r.comments}</span>
                </div>
              </div>
              {/* Completion bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 5, background: t.bgSurface, borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${r.completion}%`, background: `linear-gradient(90deg,${t.accent},${t.success})`, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 10, color: t.textTertiary, minWidth: 28 }}>{r.completion}%</span>
              </div>
              <p style={{ fontSize: 9, color: t.textTertiary, margin: '3px 0 0' }}>Completion rate (viewers who read all steps)</p>
            </div>
          ))}
        </Card>

        {/* Follower Growth */}
        <Card t={t}>
          <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 10px' }}>👥 Follower Growth</p>
          <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 60 }}>
            {[...CHART_DATA].map((v, i) => (
              <div key={i} style={{ flex: 1, height: `${(v / maxVal) * 100}%`, background: `linear-gradient(to top,#60A5FA,#60A5FA88)`, borderRadius: '3px 3px 0 0', minWidth: 4 }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: t.textTertiary, marginTop: 5 }}>
            <span>{days} days ago</span><span>Today</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AnalyticsWrapper() {
  return <AnalyticsPage />;
}
