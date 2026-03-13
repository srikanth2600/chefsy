'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [showPw,   setShowPw]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t || `HTTP ${r.status}`); }
      const j = await r.json();
      const token = j?.token;
      if (!token) throw new Error('No token returned.');
      try { localStorage.setItem('gharka_token', token); } catch {}

      const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!me.ok) throw new Error('Failed to verify account.');
      const meJson = await me.json();
      if (!meJson?.is_admin) {
        try { localStorage.removeItem('gharka_token'); } catch {}
        throw new Error('This account does not have admin access.');
      }
      try {
        localStorage.setItem('gharka_user_name',  meJson.full_name  ?? '');
        localStorage.setItem('gharka_user_email', meJson.email ?? email);
      } catch {}

      router.push('/adminpanel');
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm adm-login-shell">
      <div className="adm-login-card">

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,var(--acc),#c2410c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 14px', boxShadow: '0 4px 20px rgba(249,115,22,0.35)' }}>🍳</div>
          <div style={{ fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 700, color: 'var(--at)' }}>Chefsy Admin</div>
          <div style={{ fontSize: 12, color: 'var(--at3)', marginTop: 4 }}>Sign in to manage the platform</div>
        </div>

        {error && (
          <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 16, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="adm-field">
            <label className="adm-label">Email Address</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@chefsy.com"
              className="adm-input" autoFocus
            />
          </div>

          <div className="adm-field">
            <label className="adm-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="adm-input" style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--at3)', cursor: 'pointer', fontSize: 13 }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="adm-btn adm-btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '10px' }}>
            {loading ? '⏳ Signing in…' : 'Sign in to Admin Panel →'}
          </button>
        </form>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => router.push('/')}>
            ← Back to site
          </button>
          <span style={{ fontSize: 11, color: 'var(--at3)' }}>Admin access only</span>
        </div>
      </div>
    </div>
  );
}
