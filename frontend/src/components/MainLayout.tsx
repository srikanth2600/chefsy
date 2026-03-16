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

  // Pages that provide their own full layout should bypass the chat shell.
  // ✅ FIX: Added '/find-chef' to this list — it has its own header/layout
  //         and must NOT be wrapped in the sidebar shell.
  //         This is the ONLY change from the original file.
  if (
    pathname === '/' ||
    pathname?.startsWith('/instructions') ||
    pathname?.startsWith('/adminpanel') ||
    pathname?.startsWith('/chef') ||
    pathname?.startsWith('/chef-dashboard') ||
    pathname?.startsWith('/find-chef') ||
    pathname?.startsWith('/upgrade')
  ) {
    return <>{children}</>;
  }

  const SidebarInner = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Brand + sidebar toggle (matches chat page) */}
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
          onClick={() => setDrawerOpen((s) => !s)}
          title="Toggle sidebar"
          style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s,background 0.15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-alpha-10)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
        >
          {drawerOpen
            ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18" strokeLinecap="round"/><path d="M15 9l-3 3 3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18" strokeLinecap="round"/><path d="M13 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        </button>
      </div>

      <div style={{ padding: drawerOpen ? '10px 10px 4px' : '10px 6px 4px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={() => router.push('/')}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: drawerOpen ? 'flex-start' : 'center', gap: 8, padding: drawerOpen ? '9px 12px' : '9px', borderRadius: 10, border: 'none', background: 'var(--accent-alpha-10)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 2 }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          {drawerOpen && 'New Chat'}
        </button>
        <a
          href="/restaurants"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: drawerOpen ? 'flex-start' : 'center', gap: 8, padding: drawerOpen ? '8px 12px' : '8px', borderRadius: 10, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.15s,color 0.15s' }}
        >
          <span style={{ fontSize: 15 }}>🍽️</span>
          {drawerOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Restaurant Near You</span>}
        </a>
        <a
          href="/find-chef"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: drawerOpen ? 'flex-start' : 'center', gap: 8, padding: drawerOpen ? '8px 12px' : '8px', borderRadius: 10, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.15s,color 0.15s' }}
        >
          <span style={{ fontSize: 15 }}>👨‍🍳</span>
          {drawerOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Find a Chef</span>}
        </a>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: drawerOpen ? '4px 8px' : '4px 6px', minHeight: 0 }}>
        {drawerOpen && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', paddingLeft: 8, paddingTop: 4, marginBottom: 8 }}>Recent chats</p>}
        {recentChats.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', paddingLeft: drawerOpen ? 8 : 0 }}>No chats yet</div>
        ) : (
          recentChats.slice(0, 20).map((c) => (
            <button
              key={c.chat_id}
              type="button"
              onClick={async () => {
                await loadChat(c.chat_id);
                router.push('/');
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: drawerOpen ? '8px 10px' : '8px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, transition: 'background 0.15s,color 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-alpha-10)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              <span style={{ fontSize: 14 }}>💬</span>
              {drawerOpen && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.title}</span>}
            </button>
          ))
        )}
      </div>

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

  const sidebarWidth = drawerOpen ? 264 : 60;

  return (
    <div className="h-screen flex overflow-hidden" style={{ ['--sidebar-w' as any]: `${sidebarWidth}px` }}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className="fixed top-16 bottom-0 left-0 z-30 overflow-hidden hidden lg:block"
        style={{
          width: sidebarWidth,
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.28s cubic-bezier(.4,0,.2,1),background 0.3s',
        }}
      >
        {SidebarInner}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-50 overflow-hidden lg:hidden ${mobileSidebarOpen ? 'block' : 'hidden'}`}
        style={{
          width: 264,
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {SidebarInner}
      </aside>

      <div className="flex-1 lg:ml-[var(--sidebar-w)] ml-0">
        {/* Header */}
        <header className="fixed top-0 h-16 z-40 flex items-center justify-between px-6 lg:px-10 left-0 lg:left-[var(--sidebar-w)] right-0 bg-[#1a1815]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMobileSidebarOpen((v) => !v);
              }}
              className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-md bg-white/10 text-white"
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <button type="button" onClick={() => router.push('/')} className="inline-flex items-center gap-2 text-white font-semibold" aria-label="Back to chat">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
              Chat
            </button>
          </div>
        </header>

        {/* Content — single scroll container */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ paddingTop: 64, paddingBottom: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
