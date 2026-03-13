 'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Login failed (${res.status})`);
      }
      const j = await res.json();
      const token = j?.token;
      if (!token) throw new Error('No token returned from login');
      try { localStorage.setItem('gharka_token', token); } catch {}

      // Verify admin status
      const meRes = await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!meRes.ok) throw new Error('Failed to verify account');
      const me = await meRes.json();
      if (!me || !me.is_admin) {
        try { localStorage.removeItem('gharka_token'); } catch {}
        throw new Error('Account is not an admin');
      }

      // Redirect to admin panel
      router.push('/admin');
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg,#11100e,#191814)', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="w-full max-w-md p-8 bg-[#12110f] rounded-lg shadow-lg border border-white/6">
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo.png" alt="Chefsy" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Sign in</h1>
            <p className="text-xs text-white/40">Enter your admin credentials to continue</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div>
            <label className="block text-xs text-white/60 mb-1">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded bg-[#231f1b] text-white" />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 rounded bg-[#231f1b] text-white" />
          </div>
          <div className="flex items-center justify-between">
            <button type="submit" className="px-4 py-2 bg-orange-500 rounded text-white" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <button type="button" className="text-sm text-white/40 hover:text-white" onClick={() => router.push('/')}>Back to site</button>
          </div>
          <p className="text-xs text-white/40 mt-2">If you don't have an admin password, run <code>backend/scripts/create_admin_and_test.py</code> to create a token you can paste into the admin panel.</p>
        </form>
      </div>
    </div>
  );
}

