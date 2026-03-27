'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import './admin.css';

const NAV = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard',  href: '/adminpanel',            icon: '▦',  label: 'Dashboard' },
      { id: 'analytics',  href: '/adminpanel/analytics',  icon: '↗',  label: 'Analytics' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'recipes',    href: '/adminpanel/recipes',    icon: '🍳',  label: 'Recipes',   badge: '' },
      { id: 'videos',     href: '/adminpanel/videos',     icon: '▶',  label: 'Videos',    badge: '' },
      { id: 'reels',      href: '/adminpanel/reels',      icon: '🎬', label: 'Chef Reels', badge: '' },
      { id: 'ads',        href: '/adminpanel/ads',        icon: '◈',  label: 'Ads & Banners' },
    ],
  },
  {
    label: 'Users',
    items: [
      { id: 'users',      href: '/adminpanel/users',      icon: '◎',  label: 'All Users' },
      { id: 'chefs',      href: '/adminpanel/chefs',      icon: '👨‍🍳',  label: 'Chefs / Pros' },
      { id: 'reviews',    href: '/adminpanel/reviews',    icon: '⭐',  label: 'Reviews' },
      { id: 'messages',   href: '/adminpanel/messages',   icon: '💬',  label: 'Messages' },
      { id: 'feedback',   href: '/adminpanel/feedback',   icon: '✦',  label: 'Feedback & Ratings' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { id: 'packages',          href: '/adminpanel/packages',          icon: '📦',  label: 'Packages' },
      { id: 'llm-models',       href: '/adminpanel/llm-models',       icon: '🤖',  label: 'LLM Models' },
      { id: 'chef-roles',          href: '/adminpanel/chef-roles',          icon: '🏷',  label: 'Chef Roles' },
      { id: 'organization-types', href: '/adminpanel/organization-types', icon: '🏢',  label: 'Org Types' },
      { id: 'categories',          href: '/adminpanel/categories',          icon: '📂',  label: 'Categories' },
      { id: 'meal-plan-options', href: '/adminpanel/meal-plan-options', icon: '🥗',  label: 'Meal Plan Options' },
      { id: 'meal-plans',        href: '/adminpanel/meal-plans',        icon: '🍽️',  label: 'Meal Plans' },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'chats',      href: '/adminpanel/chats',      icon: '◻',  label: 'Chat Logs' },
      { id: 'admins',     href: '/adminpanel/admins',     icon: '⬡',  label: 'Admins' },
      { id: 'settings',   href: '/adminpanel/settings',   icon: '⚙',  label: 'Settings' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [adminName, setAdminName] = useState('Admin');
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    try {
      const n = localStorage.getItem('gharka_user_name');
      const e = localStorage.getItem('gharka_user_email');
      if (n) setAdminName(n);
      if (e) setAdminEmail(e);
    } catch {}
  }, []);

  const logout = () => {
    try { ['gharka_token', 'gharka_user_name', 'gharka_user_email'].forEach(k => localStorage.removeItem(k)); } catch {}
    router.push('/adminpanel/login');
  };

  // Derive active page id from pathname
  const activeId = (() => {
    if (pathname === '/adminpanel') return 'dashboard';
    const seg = pathname.split('/').pop() || '';
    return seg;
  })();

  // If this is the login page, render children without the admin shell (no sidebar/header)
  if (pathname?.endsWith('/login')) {
    return <>{children}</>;
  }

  // Derive page title
  const activeItem = NAV.flatMap(s => s.items).find(i => i.id === activeId);
  const pageTitle  = activeItem?.label ?? 'Admin Panel';

  return (
    <div className="adm">
      <div className="adm-shell">

        {/* ── Sidebar ── */}
        <aside className="adm-sidebar">
          <div className="adm-brand">
            <div className="adm-brand-logo">🍳</div>
            <div>
              <div className="adm-brand-name">Chefsy</div>
              <div className="adm-brand-sub">Admin Panel</div>
            </div>
          </div>

          <nav className="adm-nav">
            {NAV.map(section => (
              <div key={section.label} className="adm-nav-section">
                <span className="adm-nav-label">{section.label}</span>
                {section.items.map(item => (
                  <button
                    key={item.id}
                    className={`adm-nav-item${activeId === item.id ? ' active' : ''}`}
                    onClick={() => router.push(item.href)}
                  >
                    <span className="adm-nav-icon" style={{ fontSize: 14 }}>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge ? <span className="adm-nav-badge">{item.badge}</span> : null}
                  </button>
                ))}
                <div className="adm-nav-divider" />
              </div>
            ))}
          </nav>

          <div className="adm-sidebar-footer">
            <div className="adm-user" onClick={logout} title="Click to logout">
              <div className="adm-user-av">{adminName.charAt(0).toUpperCase()}</div>
              <div style={{ overflow: 'hidden', minWidth: 0 }}>
                <div className="adm-user-name adm-truncate">{adminName}</div>
                <div className="adm-user-role adm-truncate">{adminEmail || 'Super Admin'}</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--at3)', marginLeft: 'auto' }}>
                <path strokeLinecap="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="adm-main">
          {/* Header */}
          <header className="adm-header">
            <div className="adm-header-left">
              <span className="adm-page-title">{pageTitle}</span>
            </div>
            <div className="adm-header-right">
              <input className="adm-search" placeholder="Search anything…" />
              <button className="adm-icon-btn" title="Notifications">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </button>
              <button className="adm-icon-btn" onClick={() => router.push('/')} title="View site">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path strokeLinecap="round" d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
              </button>
            </div>
          </header>

          {/* Page content */}
          <div className="adm-body">
            <div className="adm-content">
              {children}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
