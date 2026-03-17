'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import { useSearch } from '@/context/SearchContext';
import { useRouter } from 'next/navigation';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { recentChats, loadChat, userName, userEmailDisplay } = useSearch();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(true);

  // Pages that provide their own full layout bypass the shell entirely.
  if (
    pathname === '/' ||
    pathname?.startsWith('/instructions') ||
    pathname?.startsWith('/adminpanel') ||
    pathname?.startsWith('/chef') ||
    pathname?.startsWith('/chef-dashboard') ||
    pathname?.startsWith('/find-chef') ||
    pathname?.startsWith('/upgrade') ||
    pathname?.startsWith('/recipes')
  ) {
    return <>{children}</>;
  }

  const sidebarWidth = drawerOpen ? 264 : 60;

  const SidebarContent = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand + toggle */}
      <div style={{ padding: '12px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <img src="/logo.png" alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
          {drawerOpen && (
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em' }}>Chefsy</h1>
              <p style={{ fontSize: 10, color: 'var(--accent)', margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>AI Kitchen</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setDrawerOpen(s => !s)}
          title="Toggle sidebar"
          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s,background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-alpha-10)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
        >
          {drawerOpen
            ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18" strokeLinecap="round"/><path d="M15 9l-3 3 3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18" strokeLinecap="round"/><path d="M13 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        </button>
      </div>

      {/* Nav items */}
      <div style={{ padding: drawerOpen ? '10px 10px 4px' : '10px 6px 4px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={() => router.push('/')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: drawerOpen ? 'flex-start' : 'center', gap: 8, padding: drawerOpen ? '9px 12px' : '9px', borderRadius: 10, border: 'none', background: 'var(--accent-alpha-10)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 2 }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          {drawerOpen && 'New Chat'}
        </button>

        {[
          { href: '/', icon: '🍳', label: 'AI Recipes', active: false },
          { href: '/find-chef', icon: '👨‍🍳', label: 'Find a Chef', active: pathname?.startsWith('/find-chef') },
          { href: '/meal-plans', icon: '🍽️', label: 'Meal Planner', active: pathname?.startsWith('/meal-plans') },
          { href: '/profile', icon: '👤', label: 'My Profile', active: pathname?.startsWith('/profile') },
        ].map(({ href, icon, label, active }) => (
          <a
            key={href + label}
            href={href}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: drawerOpen ? 'flex-start' : 'center', gap: 8, padding: drawerOpen ? '8px 12px' : '8px', borderRadius: 10, textDecoration: 'none', color: active ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.15s,color 0.15s', background: active ? 'var(--accent-alpha-10)' : 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-alpha-10)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = active ? 'var(--accent-alpha-10)' : 'transparent'; (e.currentTarget as HTMLElement).style.color = active ? 'var(--accent)' : 'var(--text-secondary)'; }}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
            {drawerOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
          </a>
        ))}
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 4px' }} />
      </div>

      {/* Recent chats */}
      <div style={{ flex: 1, overflowY: 'auto', padding: drawerOpen ? '4px 8px' : '4px 6px', minHeight: 0 }}>
        {drawerOpen && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', paddingLeft: 8, paddingTop: 4, marginBottom: 8 }}>Recent chats</p>}
        {recentChats.length === 0 ? (
          drawerOpen ? <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingLeft: 8 }}>No chats yet</div> : null
        ) : (
          recentChats.slice(0, 20).map((c: { chat_id: number; title: string }) => (
            <button
              key={c.chat_id}
              type="button"
              onClick={async () => { await loadChat(c.chat_id); router.push('/'); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: drawerOpen ? '8px 10px' : '8px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, transition: 'background 0.15s,color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-alpha-10)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.5 }}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              {drawerOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.title}</span>}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, padding: drawerOpen ? '12px' : '12px 8px', borderTop: '1px solid var(--border)' }}>
        <button onClick={() => router.push('/upgrade')} style={{ width: '100%', padding: drawerOpen ? '10px 16px' : '10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,var(--claude-orange),#C45E3A)', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit', cursor: 'pointer', marginBottom: 10 }}>
          {drawerOpen ? '✦ Upgrade to Pro' : '✦'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 10, justifyContent: drawerOpen ? 'flex-start' : 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-alpha-20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--accent)', fontWeight: 700 }}>
            {(userName ?? 'G').charAt(0).toUpperCase()}
          </div>
          {drawerOpen && (
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName ?? 'Guest'}</p>
              {userEmailDisplay && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmailDisplay}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: "'DM Sans',system-ui,sans-serif" }}>

      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Mobile overlay sidebar */}
      {mobileSidebarOpen && (
        <aside style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          width: 264, background: 'var(--bg-elevated)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}>
          {SidebarContent}
        </aside>
      )}

      {/* Desktop sidebar — IN FLOW (not fixed), same pattern as main chat page */}
      <aside style={{
        width: sidebarWidth,
        flexShrink: 0,
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.28s cubic-bezier(.4,0,.2,1)',
        overflow: 'hidden',
      }}>
        {SidebarContent}
      </aside>

      {/* Main content column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Header — matches chat page header height/style */}
        <header style={{ flexShrink: 0, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => router.push('/')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
              Chat
            </button>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {pathname?.startsWith('/meal-plans') ? '🍽️ Meal Planner'
              : pathname?.startsWith('/profile') ? '👤 Profile'
              : 'Chefsy'}
          </span>
          <div style={{ width: 100 }} />
        </header>

        {/* Scrollable content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
