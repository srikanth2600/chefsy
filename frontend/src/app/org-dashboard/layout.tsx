'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChefThemeProvider, useChefTheme } from '@/components/chef/ChefThemeContext';
import { Avatar, ThemeToggle } from '@/components/chef/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

const TYPE_ICON: Record<string, string> = {
  gym: '🏋️', nutrition: '🥗', corporate: '🏢', others: '🏛️',
};

const NAV_ITEMS = [
  { href: '/org-dashboard',              icon: '🏠', label: 'Dashboard' },
  { href: '/org-dashboard/meal-planner', icon: '🥗', label: 'Meal Planner' },
  { href: '/org-dashboard/members',      icon: '👥', label: 'Members' },
  { href: '/org-dashboard/groups',       icon: '◎',  label: 'Groups' },
  { href: '/org-dashboard/content',      icon: '🎬', label: 'Content' },
  { href: '/org-dashboard/settings',     icon: '⚙',  label: 'Settings' },
];

function OrgShell({ children }: { children: React.ReactNode }) {
  const { t } = useChefTheme();
  const router   = useRouter();
  const pathname = usePathname();

  const [org, setOrg] = useState({
    org_name: 'My Organisation',
    org_type: '',
    slug: '',
    logo_url: null as string | null,
    is_public: false,
  });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const tok = (() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } })();
    if (!tok) { router.replace('/auth/login'); return; }

    fetch(`${API}/org/me`, { headers: { Authorization: `Bearer ${tok}` } })
      .then(r => {
        if (r.status === 404) { router.replace('/org/register'); return null; }
        if (!r.ok) throw new Error('auth');
        return r.json();
      })
      .then(d => {
        if (d) setOrg({
          org_name:   d.org_name   || 'My Organisation',
          org_type:   d.org_type   || '',
          slug:       d.slug       || '',
          logo_url:   d.logo_url   || null,
          is_public:  !!d.is_public,
        });
      })
      .catch(() => router.replace('/auth/login'))
      .finally(() => setChecking(false));
  }, [router]);

  const handleLogout = () => {
    try {
      localStorage.removeItem('gharka_token');
      localStorage.removeItem('gharka_has_org');
      localStorage.removeItem('gharka_account_type');
    } catch {}
    router.push('/');
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: t.bg, color: t.textSecondary, fontFamily: 'inherit' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: t.bg, overflow: 'hidden', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${t.border}`, background: t.bgElevated, display: 'flex', flexDirection: 'column' }}>

        {/* Org identity */}
        <div style={{ padding: '16px 13px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 10 }}>
            <Avatar
              name={org.org_name}
              color={t.accent}
              imageUrl={org.logo_url ? `${API}${org.logo_url}` : undefined}
              size={38}
              radius={10}
            />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: t.textPrimary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {org.org_name}
              </p>
              {org.org_type && (
                <p style={{ fontSize: 9, color: t.textTertiary, margin: 0, textTransform: 'capitalize' }}>
                  {TYPE_ICON[org.org_type.toLowerCase()] || '🏢'} {org.org_type}
                </p>
              )}
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: t.accent, background: t.accentBg, border: `1px solid ${t.borderAcc}`, borderRadius: 99, padding: '2px 10px', letterSpacing: '0.06em' }}>
            ORG DASHBOARD
          </span>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || (item.href !== '/org-dashboard' && pathname.startsWith(item.href));
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 14px', background: isActive ? t.accentBg : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: isActive ? t.accent : t.textSecondary,
                  fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
                  width: '100%', fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.accentBg; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            );
          })}

          {/* Public page link */}
          {org.is_public && org.slug && (
            <button
              onClick={() => window.open(`/org/${org.slug}`, '_blank')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', background: 'transparent',
                border: 'none', cursor: 'pointer',
                color: t.textSecondary, fontSize: 12, fontFamily: 'inherit',
                textAlign: 'left', width: '100%', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = t.accentBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 14 }}>👁</span>
              <span style={{ flex: 1 }}>Public Page</span>
              <span style={{ fontSize: 9, color: t.textTertiary }}>↗</span>
            </button>
          )}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', background: 'transparent',
            border: 'none', borderTop: `1px solid ${t.border}`,
            cursor: 'pointer', color: t.error || '#EF4444',
            fontSize: 12, fontFamily: 'inherit', width: '100%', textAlign: 'left',
          }}
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
      <main style={{ flex: 1, overflowY: 'auto', padding: 28, color: t.textPrimary }}>
        {children}
      </main>
    </div>
  );
}

export default function OrgDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChefThemeProvider>
      <OrgShell>{children}</OrgShell>
    </ChefThemeProvider>
  );
}
