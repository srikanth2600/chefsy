'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const ORG_TYPES = [
  { value: 'gym',       label: 'Gym / Fitness Centre' },
  { value: 'nutrition', label: 'Nutrition / Dietitian' },
  { value: 'corporate', label: 'Corporate Wellness' },
  { value: 'others',    label: 'Other' },
];

function inferOrgType(typeName: string | null): string {
  if (!typeName) return 'others';
  const t = typeName.toLowerCase();
  if (t.includes('gym') || t.includes('fitness')) return 'gym';
  if (t.includes('nutri') || t.includes('diet')) return 'nutrition';
  if (t.includes('corp') || t.includes('company') || t.includes('enterprise')) return 'corporate';
  return 'others';
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 9,
  border: '1px solid #e2e8f0', background: '#fff',
  color: '#1e293b', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  fontSize: 11, color: '#64748b', fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  display: 'block', marginBottom: 6,
};

export default function OrgRegisterPage() {
  const router = useRouter();

  const [user, setUser]       = useState<any | null>(null);
  const [orgName,   setOrgName]   = useState('');
  const [orgType,   setOrgType]   = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');
  const [address1,  setAddress1]  = useState('');
  const [address2,  setAddress2]  = useState('');
  const [city,      setCity]      = useState('');
  const [state,     setState]     = useState('');
  const [postcode,  setPostcode]  = useState('');
  const [country,   setCountry]   = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    const t = tok();
    if (!t) { router.replace('/'); return; }

    // Check if already has org profile — skip setup
    fetch(`${API}/org/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => {
        if (r.ok) {
          localStorage.setItem('gharka_has_org', 'true');
          router.replace('/org-dashboard');
        }
      })
      .catch(() => {});

    // Load user profile to pre-fill
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setUser(d);
        setOrgName(d.organization_name || '');
        setOrgType(inferOrgType(d.organization_type_name));
        setEmail(d.email || '');
        setPhone(d.phone || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!orgName.trim()) { setError('Organisation name is required.'); return; }
    if (!email.trim())   { setError('Official email is required.'); return; }

    setSaving(true);
    try {
      const r = await fetch(`${API}/org/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name:       orgName.trim(),
          org_type:       orgType,
          official_email: email.trim(),
          phone:          phone.trim()     || undefined,
          address_line1:  address1.trim()  || undefined,
          address_line2:  address2.trim()  || undefined,
          city:           city.trim()      || undefined,
          state:          state.trim()     || undefined,
          postcode:       postcode.trim()  || undefined,
          country:        country.trim()   || undefined,
        }),
      });

      if (r.ok) {
        localStorage.setItem('gharka_has_org', 'true');
        router.push('/org-dashboard');
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.detail || 'Registration failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', color: '#64748b' }}>
        Setting up…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Set Up Your Organisation
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Complete your organisation profile to access the dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '28px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Organisation Name *</label>
            <input
              style={inp}
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="e.g. FitZone Gym, NutriCare Centre"
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Organisation Type *</label>
            <select
              style={{ ...inp, cursor: 'pointer' }}
              value={orgType}
              onChange={e => setOrgType(e.target.value)}
              required
            >
              {ORG_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Official Email *</label>
            <input
              type="email"
              style={inp}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@yourorg.com"
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Phone</label>
            <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7000 000000" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Address Line 1</label>
            <input style={inp} value={address1} onChange={e => setAddress1(e.target.value)} placeholder="Building / Street" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Address Line 2</label>
            <input style={inp} value={address2} onChange={e => setAddress2(e.target.value)} placeholder="Floor, Suite, Complex (optional)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lbl}>City</label>
              <input style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="London" />
            </div>
            <div>
              <label style={lbl}>Postcode</label>
              <input style={inp} value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="SW1A 1AA" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div>
              <label style={lbl}>State / Region</label>
              <input style={inp} value={state} onChange={e => setState(e.target.value)} placeholder="England" />
            </div>
            <div>
              <label style={lbl}>Country</label>
              <input style={inp} value={country} onChange={e => setCountry(e.target.value)} placeholder="United Kingdom" />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{ width: '100%', padding: '12px', borderRadius: 9, border: 'none', background: saving ? '#93c5fd' : '#3b82f6', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
          >
            {saving ? 'Creating organisation…' : 'Create Organisation & Go to Dashboard →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
          Already set up?{' '}
          <a href="/org-dashboard" style={{ color: '#3b82f6', textDecoration: 'none' }}>Go to Org Dashboard →</a>
        </p>
      </div>
    </div>
  );
}
