'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #e2e8f0', background: '#fff',
  color: '#1e293b', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
};
const inpDis: React.CSSProperties = { ...inp, background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' };
const lbl: React.CSSProperties = {
  fontSize: 11, color: '#64748b', fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  display: 'block', marginBottom: 5,
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 12, padding: '20px 22px', marginBottom: 16,
};
const cardH: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#1e293b',
  marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
};
const btn: React.CSSProperties = {
  padding: '9px 22px', borderRadius: 8, border: 'none',
  background: '#3b82f6', color: '#fff', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
};

export default function OrgSettingsPage() {
  const router = useRouter();

  const [org, setOrg] = useState<any | null>(null);

  // General
  const [orgName, setOrgName]     = useState('');
  const [tagline, setTagline]     = useState('');
  const [phone, setPhone]         = useState('');
  const [website, setWebsite]     = useState('');
  const [isPublic, setIsPublic]   = useState(false);
  const [accentColor, setAccent]  = useState('#3B82F6');

  // Address
  const [line1, setLine1]         = useState('');
  const [line2, setLine2]         = useState('');
  const [city, setCity]           = useState('');
  const [state, setState]         = useState('');
  const [postcode, setPostcode]   = useState('');
  const [country, setCountry]     = useState('');
  const [lat, setLat]             = useState('');
  const [lng, setLng]             = useState('');

  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = tok();
    if (!t) { router.replace('/auth/login'); return; }
    fetch(`${API}/org/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setOrg(d);
        setOrgName(d.org_name || '');
        setTagline(d.tagline || '');
        setPhone(d.phone || '');
        setWebsite(d.website_url || '');
        setIsPublic(!!d.is_public);
        setAccent(d.accent_color || '#3B82F6');
        setLine1(d.address_line1 || '');
        setLine2(d.address_line2 || '');
        setCity(d.city || '');
        setState(d.state || '');
        setPostcode(d.postcode || '');
        setCountry(d.country || '');
        setLat(d.latitude != null ? String(d.latitude) : '');
        setLng(d.longitude != null ? String(d.longitude) : '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const r = await fetch(`${API}/org/me`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name:     orgName.trim() || null,
          tagline:      tagline.trim() || null,
          phone:        phone.trim() || null,
          website_url:  website.trim() || null,
          is_public:    isPublic,
          accent_color: accentColor,
          address_line1: line1.trim() || null,
          address_line2: line2.trim() || null,
          city:          city.trim() || null,
          state:         state.trim() || null,
          postcode:      postcode.trim() || null,
          country:       country.trim() || null,
        }),
      });
      if (r.ok) {
        setMsg('Saved!');
        // Refresh to show auto-geocoded coordinates
        const updated = await fetch(`${API}/org/me`, { headers: { Authorization: `Bearer ${tok()}` } });
        if (updated.ok) {
          const d = await updated.json();
          setLat(d.latitude != null ? String(d.latitude) : '');
          setLng(d.longitude != null ? String(d.longitude) : '');
        }
      } else {
        const err = await r.json().catch(() => ({}));
        setMsg(err.detail || 'Failed to save.');
      }
    } catch { setMsg('Network error.'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 700, fontFamily: 'inherit', color: '#1e293b' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>
        Organisation Settings
      </h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
        Manage your organisation profile, contact info and location.
      </p>

      {/* ── General Info ── */}
      <div style={card}>
        <p style={cardH}><span>🏢</span> General Information</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Organisation Name</label>
            <input style={inp} value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Your organisation name" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Tagline</label>
            <input style={inp} value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Short description or motto" />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7000 000000" />
          </div>
          <div>
            <label style={lbl}>Website</label>
            <input style={inp} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://yourorg.com" />
          </div>
          <div>
            <label style={lbl}>Org Type</label>
            <input style={inpDis} value={org?.org_type || ''} disabled />
          </div>
          <div>
            <label style={lbl}>Slug</label>
            <input style={inpDis} value={org?.slug || ''} disabled />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 18 }}>
            <input
              type="checkbox" id="isPublic" checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
            />
            <label htmlFor="isPublic" style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}>
              List organisation publicly
            </label>
          </div>
          <div>
            <label style={lbl}>Accent Colour</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={accentColor} onChange={e => setAccent(e.target.value)}
                style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', padding: 2 }} />
              <input style={{ ...inp, flex: 1 }} value={accentColor} onChange={e => setAccent(e.target.value)} placeholder="#3B82F6" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Address ── */}
      <div style={card}>
        <p style={cardH}><span>📍</span> Address &amp; Location</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Address Line 1</label>
            <input style={inp} value={line1} onChange={e => setLine1(e.target.value)} placeholder="Unit / Building number, Street" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Address Line 2</label>
            <input style={inp} value={line2} onChange={e => setLine2(e.target.value)} placeholder="Floor, Suite, Complex name (optional)" />
          </div>
          <div>
            <label style={lbl}>City</label>
            <input style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
          </div>
          <div>
            <label style={lbl}>State / Region</label>
            <input style={inp} value={state} onChange={e => setState(e.target.value)} placeholder="State or county" />
          </div>
          <div>
            <label style={lbl}>Postcode</label>
            <input style={inp} value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="Postcode / PIN" />
          </div>
          <div>
            <label style={lbl}>Country</label>
            <input style={inp} value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. United Kingdom" />
          </div>
        </div>

        {(lat || lng) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Latitude</label>
              <input style={inpDis} value={lat} disabled />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Longitude</label>
              <input style={inpDis} value={lng} disabled />
            </div>
          </div>
        )}
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
          Coordinates are auto-detected from the address above when you save.
        </p>
      </div>

      {/* ── Save ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={{ ...btn, padding: '10px 32px' }} disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {msg && (
          <span style={{ fontSize: 13, color: msg === 'Saved!' ? '#22c55e' : '#ef4444' }}>{msg}</span>
        )}
      </div>
    </div>
  );
}
