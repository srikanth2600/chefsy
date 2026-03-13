 'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPanelLogin() {
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Enter email and password'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Login failed (${res.status})`);
      }
      const j = await res.json();
      const token = j?.token;
      if (!token) throw new Error('No token returned');
      try { localStorage.setItem('gharka_token', token); } catch {}

      // verify admin
      const meRes = await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!meRes.ok) { throw new Error('Failed to verify account'); }
      const me = await meRes.json();
      if (!me?.is_admin) {
        try { localStorage.removeItem('gharka_token'); } catch {}
        throw new Error('Account is not an admin');
      }

      router.push('/adminpanel');
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0a08] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#12110f] rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
              <p className="text-xs text-white/40">Sign in to manage users, recipes and videos</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-sm text-red-400">{error}</div>}

            <div>
              <label className="block text-xs text-white/60 mb-2">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#231f1b] text-white outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#231f1b] text-white outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="Enter your password"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                className="ml-auto px-4 py-2 bg-orange-500 rounded font-semibold text-black disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-transparent border border-white/10 rounded text-white/80"
                onClick={() => router.push('/')}
              >
                Back to site
              </button>
            </div>

            <p className="text-xs text-white/40 mt-2">If you don't have an admin account, ask your system administrator or run the setup script to create one.</p>
          </form>
        </div>
      </div>
    </div>
  );
}

