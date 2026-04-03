'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

const NAV_ITEMS = [
  { href: '/org-dashboard',                    icon: '▦',  label: 'Dashboard' },
  { href: '/org-dashboard/meal-planner',        icon: '🥗', label: 'Meal Planner' },
  { href: '/org-dashboard/members',             icon: '◎',  label: 'Members' },
  { href: '/org-dashboard/groups',              icon: '👥', label: 'Groups' },
  { href: '/org-dashboard/content',             icon: '🎬', label: 'Content' },
  { href: '/org-dashboard/settings',            icon: '⚙',  label: 'Settings' },
];

export default function OrgDashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [orgName, setOrgName] = useState('My Organisation');
  const [orgType, setOrgType] = useState('');
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
        if (d) {
          setOrgName(d.org_name || 'My Organisation');
          setOrgType(d.org_type || '');
        }
      })
      .catch(() => router.replace('/auth/login'))
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, background: '#0f172a', color: '#e2e8f0',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Org identity */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Org Dashboard
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
            {orgName}
          </div>
          {orgType && (
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize', marginTop: 2 }}>
              {orgType}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || (item.href !== '/org-dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, marginBottom: 2,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? '#f1f5f9' : '#94a3b8',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 11, color: '#475569' }}>
          Powered by Chefsy
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        {children}
      </main>
    </div>
  );
}
