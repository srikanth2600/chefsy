'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChefThemeProvider, useChefTheme } from '@/components/chef/ChefThemeContext';
import { Avatar, Pill, Btn, ThemeToggle } from '@/components/chef/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

function ChefShell({ children }: { children: React.ReactNode }) {
  const { t } = useChefTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [chef, setChef] = useState({ name: '', slug: '', avatar_color: '#DA7756', plan: 'free', verified: false });

  useEffect(() => {
    const tok = (() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } })();
    if (!tok) return;
    fetch(`${API}/chefs/me/profile`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setChef({ name: d.name || '', slug: d.slug || '', avatar_color: d.avatar_color || '#DA7756', plan: d.plan || 'free', verified: d.is_verified ?? false });
      }).catch(() => {});
  }, []);

  const isPro = chef.plan === 'pro';

  const activeId = pathname === '/chef-dashboard' ? 'dashboard'
    : pathname?.includes('/analytics') ? 'analytics'
    : pathname?.includes('/profile') ? 'profile'
    : pathname?.includes('/recipes') ? 'recipes'
    : pathname?.includes('/reels') ? 'reels'
    : '';

  const navItems = [
    { icon: '🏠', label: 'Dashboard', href: '/chef-dashboard', id: 'dashboard' },
    { icon: '🍳', label: 'My Recipes', href: '/chef-dashboard/recipes', id: 'recipes' },
    { icon: '🤖', label: 'AI Recipe', href: '/', id: 'ai-recipe' },
    { icon: '🎬', label: 'Manage Reels', href: '/chef-dashboard/reels', id: 'reels' },
    { icon: '📊', label: 'Analytics', href: '/chef-dashboard/analytics', id: 'analytics', lock: !isPro },
    { icon: '✏️', label: 'Edit Profile', href: '/chef-dashboard/profile', id: 'profile' },
  ];

  const handleLogout = () => {
    try { localStorage.removeItem('gharka_token'); } catch {}
    router.push('/');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: t.bg, overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${t.border}`, background: t.bgElevated, display: 'flex', flexDirection: 'column' }}>
        {/* Chef info */}
        <div style={{ padding: '16px 13px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 10 }}>
            <Avatar name={chef.name || '?'} color={chef.avatar_color} size={38} radius={10} verified={chef.verified} verifiedColor={t.accent} verifiedBorder={t.bgElevated} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: t.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chef.name || '—'}</p>
              <p style={{ fontSize: 9, color: t.textTertiary, margin: 0 }}>@{chef.slug || '—'}</p>
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: isPro ? '#F59E0B' : t.accent, background: isPro ? 'rgba(245,158,11,0.15)' : t.accentBg, border: `1px solid ${isPro ? 'rgba(245,158,11,0.3)' : t.borderAcc}`, borderRadius: 99, padding: '2px 10px', letterSpacing: '0.06em' }}>
            {isPro ? '✦ PRO PLAN' : 'FREE PLAN'}
          </span>
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                onClick={() => { if (!item.lock) router.push(item.href); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: isActive ? t.accentBg : 'transparent', border: 'none', cursor: item.lock ? 'default' : 'pointer', color: item.lock ? t.textTertiary : isActive ? t.accent : t.textSecondary, fontSize: 12, fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'background 0.15s', opacity: item.lock ? 0.5 : 1 }}
                onMouseEnter={(e) => { if (!item.lock && !isActive) e.currentTarget.style.background = t.accentBg; }}
                onMouseLeave={(e) => { if (!item.lock && !isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.lock && <Pill t={t} small>PRO</Pill>}
              </button>
            );
          })}

          {/* Public page — opens in new tab */}
          {chef.slug && (
            <button
              onClick={() => window.open(`/chef/${chef.slug}`, '_blank')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: t.textSecondary, fontSize: 12, fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.accentBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 14 }}>👁</span>
              <span style={{ flex: 1 }}>Public Page</span>
              <span style={{ fontSize: 9, color: t.textTertiary }}>↗</span>
            </button>
          )}
        </div>

        {/* Upgrade CTA */}
        {!isPro && (
          <div style={{ padding: '12px 13px', borderTop: `1px solid ${t.border}` }}>
            <Btn t={t} style={{ width: '100%', padding: '9px', fontSize: 11 }}>✦ Upgrade to Pro</Btn>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'transparent', border: 'none', borderTop: `1px solid ${t.border}`, cursor: 'pointer', color: t.error || '#EF4444', fontSize: 12, fontFamily: 'inherit', width: '100%', textAlign: 'left' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 14 }}>🚪</span>
          <span>Log Out</span>
        </button>

        {/* Theme toggle */}
        <div style={{ padding: '8px 13px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
          <span style={{ fontSize: 10, color: t.textTertiary }}>Toggle theme</span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

export default function ChefDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChefThemeProvider>
      <ChefShell>{children}</ChefShell>
    </ChefThemeProvider>
  );
}
