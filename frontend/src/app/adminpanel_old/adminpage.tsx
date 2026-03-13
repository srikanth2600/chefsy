 'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPanelPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
  const router = useRouter();
  const [token, setToken] = useState<string>(() => {
    try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; }
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push('/adminpanel/login');
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          try { localStorage.removeItem('gharka_token'); } catch {}
          router.push('/adminpanel/login');
          return;
        }
        const me = await res.json();
        if (!me?.is_admin) {
          setError('Account is not an admin');
          try { localStorage.removeItem('gharka_token'); } catch {}
          router.push('/adminpanel/login');
          return;
        }
        setReady(true);
      } catch (err: any) {
        setError(String(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0a08] text-white">
        <div className="p-6 bg-[#13120f] rounded shadow">
          {error ? <div className="text-red-400">{error}</div> : <div>Checking admin credentials...</div>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Dashboard content rendered inside admin layout */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="admin-card">Users count: (loading...)</div>
        <div className="admin-card">Recipes count: (loading...)</div>
        <div className="admin-card">Videos count: (loading...)</div>
      </section>

      <section className="mt-6 admin-card">
        <h2 className="font-semibold mb-2">Quick actions</h2>
        <div className="flex gap-2">
          <button className="btn-primary">Manage Users</button>
          <button className="btn-primary">Manage Recipes</button>
          <button className="btn-primary">Manage Videos</button>
        </div>
      </section>
    </div>
  );
}

