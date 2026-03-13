 'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import './admin.css';

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#0b0a08] text-white admin-shell">
      <div className="h-screen flex">
        {/* Sidebar */}
        <aside className="admin-sidebar p-6 bg-[#0f0e0c] border-r border-white/6">
          <div className="mb-6">
            <img src="/logo.png" alt="logo" className="h-10 w-10 object-contain inline-block mr-3" />
            <div className="inline-block align-middle">
              <h2 className="font-bold">Chefsy</h2>
              <p className="text-xs text-white/40">Admin Panel</p>
            </div>
          </div>
          <nav>
            <ul className="space-y-2">
              <li><button onClick={() => router.push('/adminpanel')} className={`w-full text-left px-3 py-2 rounded nav-link ${router.pathname === '/adminpanel' ? 'active' : ''}`}>Dashboard</button></li>
              <li><button onClick={() => router.push('/adminpanel/users')} className={`w-full text-left px-3 py-2 rounded nav-link ${router.pathname === '/adminpanel/users' ? 'active' : ''}`}>Users</button></li>
              <li><button onClick={() => router.push('/adminpanel/recipes')} className={`w-full text-left px-3 py-2 rounded nav-link ${router.pathname === '/adminpanel/recipes' ? 'active' : ''}`}>Recipes</button></li>
              <li><button onClick={() => router.push('/adminpanel/videos')} className={`w-full text-left px-3 py-2 rounded nav-link ${router.pathname === '/adminpanel/videos' ? 'active' : ''}`}>Videos</button></li>
              <li><button onClick={() => router.push('/adminpanel/admins')} className={`w-full text-left px-3 py-2 rounded nav-link ${router.pathname === '/adminpanel/admins' ? 'active' : ''}`}>Admins</button></li>
            </ul>
          </nav>
          <div className="mt-6">
            <button className="w-full px-3 py-2 bg-red-600 rounded text-white" onClick={() => { try { localStorage.removeItem('gharka_token'); } catch {} ; router.push('/'); }}>Logout</button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1">
          <div className="admin-header">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold" id="admin-title">Admin Panel</h1>
            </div>
            <div className="flex items-center gap-3">
              <input className="search-input" placeholder="Search..." onKeyDown={(e) => { if (e.key === 'Enter') { /* global search hook later */ } }} />
              <div className="text-sm text-white/60">Signed in as admin</div>
            </div>
          </div>
          <main className="admin-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}


