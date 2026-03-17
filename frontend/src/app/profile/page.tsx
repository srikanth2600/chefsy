'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

// ─── Crop Modal ────────────────────────────────────────────────────────────────
function CropModal({ file, onConfirm, onCancel }: { file: File; onConfirm: (b: Blob) => void; onCancel: () => void }) {
  const DISPLAY = 260;
  const [imgSrc, setImgSrc] = useState('');
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    setNatural({ w: nw, h: nh });
    const ms = Math.max(DISPLAY / nw, DISPLAY / nh);
    setMinScale(ms); setScale(ms);
    setOffset({ x: (DISPLAY - nw * ms) / 2, y: (DISPLAY - nh * ms) / 2 });
  };

  const clamp = (s: number, ox: number, oy: number) => {
    const iw = natural.w * s, ih = natural.h * s;
    return { x: Math.min(0, Math.max(DISPLAY - iw, ox)), y: Math.min(0, Math.max(DISPLAY - ih, oy)) };
  };

  const onMouseDown = (e: React.MouseEvent) => setDrag({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  const onMouseMove = (e: React.MouseEvent) => { if (!drag) return; setOffset(clamp(scale, e.clientX - drag.x, e.clientY - drag.y)); };
  const onMouseUp = () => setDrag(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; setDrag({ x: t.clientX - offset.x, y: t.clientY - offset.y }); };
  const onTouchMove = (e: React.TouchEvent) => { if (!drag) return; const t = e.touches[0]; setOffset(clamp(scale, t.clientX - drag.x, t.clientY - drag.y)); };

  const handleConfirm = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath(); ctx.arc(200, 200, 200, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, -offset.x / scale, -offset.y / scale, DISPLAY / scale, DISPLAY / scale, 0, 0, 400, 400);
      ctx.restore();
      canvas.toBlob(b => { if (b) onConfirm(b); }, 'image/jpeg', 0.92);
    };
    img.src = imgSrc;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#2e2a24', borderRadius: 16, padding: 24, width: DISPLAY + 48, border: '1px solid rgba(255,255,255,0.1)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#F5EFE6', marginBottom: 14, textAlign: 'center' }}>Crop Profile Photo</p>
        <div style={{ width: DISPLAY, height: DISPLAY, borderRadius: '50%', overflow: 'hidden', position: 'relative', cursor: 'grab', border: '2px solid rgba(255,255,255,0.15)', margin: '0 auto' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}>
          {imgSrc && <img src={imgSrc} onLoad={onLoad} alt="" style={{ position: 'absolute', left: offset.x, top: offset.y, width: natural.w * scale, height: natural.h * scale, pointerEvents: 'none', userSelect: 'none' }} />}
        </div>
        <div style={{ marginTop: 12 }}>
          <input type="range" min={minScale} max={minScale * 3} step={0.01} value={scale}
            onChange={e => { const ns = Number(e.target.value); setOffset(clamp(ns, offset.x, offset.y)); setScale(ns); }}
            style={{ width: '100%', accentColor: '#F97316' }} />
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4 }}>Drag · Scroll or slide to zoom</p>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleConfirm} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: '#F97316', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const CHEF_TYPES = ['Chef', 'Restaurant/Foodcourt'];
const ACTIVITY_LEVELS = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extra Active'];
const HEALTH_GOALS = ['Lose Weight', 'Maintain Weight', 'Gain Muscle', 'Eat Healthier', 'Improve Fitness', 'Manage Condition'];

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'var(--bg-base,#131110)', color: 'var(--text-primary,#F5EFE6)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const inpDis: React.CSSProperties = { ...inp, opacity: 0.4, cursor: 'not-allowed' };
const lbl: React.CSSProperties = { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', display: 'block', marginBottom: 5 };
const card: React.CSSProperties = { background: 'var(--bg-elevated,#252220)', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: 14, padding: '16px 18px', marginBottom: 12 };
const cardH: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-primary,#F5EFE6)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 };
const btn: React.CSSProperties = { padding: '8px 20px', borderRadius: 9, border: 'none', background: '#F97316', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' };

interface BodyInfo {
  height_cm: string;
  weight_kg: string;
  activity_level: string;
  health_goals: string[];
  date_of_birth: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any | null>(null);

  // Personal info
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [gender, setGender] = useState('');

  // Structured address
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [city, setCity]           = useState('');
  const [postcode, setPostcode]   = useState('');
  const [lat, setLat]             = useState('');
  const [lng, setLng]             = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Body & Lifestyle
  const [body, setBody] = useState<BodyInfo>({
    height_cm: '', weight_kg: '', activity_level: '', health_goals: [], date_of_birth: '',
  });

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cropFile, setCropFile]   = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Chef
  const [slug, setSlug]             = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [becomingChef, setBecomingChef] = useState(false);
  const [chefSuccess, setChefSuccess]   = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');

  useEffect(() => {
    const t = tok();
    if (!t) { router.push('/'); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setUser(d);
        setName(d.full_name || '');
        setPhone(d.phone || '');
        setGender(d.gender || '');
        setAddrLine1(d.address_line1 || '');
        setAddrLine2(d.address_line2 || '');
        setCity(d.city || '');
        setPostcode(d.postcode || '');
        setLat(d.latitude != null ? String(d.latitude) : '');
        setLng(d.longitude != null ? String(d.longitude) : '');
        setAvatarUrl(d.profile_pic || null);
        const bi = d.body_info || {};
        setBody({
          height_cm: bi.height_cm ? String(bi.height_cm) : '',
          weight_kg: bi.weight_kg ? String(bi.weight_kg) : '',
          activity_level: bi.activity_level || '',
          health_goals: bi.health_goals || [],
          date_of_birth: bi.date_of_birth || '',
        });
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug || slug.length < 3) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    const t = setTimeout(() => {
      fetch(`${API}/chefs/${slug}`)
        .then(r => setSlugStatus(r.status === 404 ? 'available' : 'taken'))
        .catch(() => setSlugStatus('idle'));
    }, 500);
    return () => clearTimeout(t);
  }, [slug]);

  const geocodeAddress = async () => {
    const q = [addrLine1, addrLine2, city, postcode].filter(Boolean).join(', ');
    if (!q) return;
    setGeocoding(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
      const data = await res.json();
      if (data?.[0]) {
        setLat(parseFloat(data[0].lat).toFixed(6));
        setLng(parseFloat(data[0].lon).toFixed(6));
      }
    } catch {}
    setGeocoding(false);
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setCropFile(f); e.target.value = ''; }
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'avatar.jpg');
      const r = await fetch(`${API}/auth/me/avatar`, {
        method: 'POST', headers: { Authorization: `Bearer ${tok()}` }, body: fd,
      });
      if (r.ok) { const d = await r.json(); setAvatarUrl(d.url); }
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    setSaving(true); setMsg('');
    try {
      const body_info = {
        height_cm: body.height_cm ? parseFloat(body.height_cm) : null,
        weight_kg: body.weight_kg ? parseFloat(body.weight_kg) : null,
        activity_level: body.activity_level || null,
        health_goals: body.health_goals,
        date_of_birth: body.date_of_birth || null,
      };
      const r = await fetch(`${API}/auth/me`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim(),
          phone: phone.trim() || null,
          gender: gender || null,
          address_line1: addrLine1.trim() || null,
          address_line2: addrLine2.trim() || null,
          city: city.trim() || null,
          postcode: postcode.trim() || null,
          latitude: lat ? parseFloat(lat) : null,
          longitude: lng ? parseFloat(lng) : null,
          body_info,
        }),
      });
      if (r.ok) {
        setMsg('Saved!');
      } else { setMsg('Failed to save.'); }
    } catch { setMsg('Network error.'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleBecomeChef = async () => {
    if (slugStatus !== 'available' || !slug) return;
    setBecomingChef(true);
    try {
      const r = await fetch(`${API}/auth/become-chef`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chef_slug: slug }),
      });
      if (r.ok) {
        setChefSuccess(true);
        setUser((u: any) => u ? { ...u, user_type: 'Chef' } : u);
      } else {
        const d = await r.json().catch(() => ({}));
        setMsg(d.detail || 'Failed.'); setTimeout(() => setMsg(''), 4000);
      }
    } catch { setMsg('Network error.'); setTimeout(() => setMsg(''), 3000); }
    setBecomingChef(false);
  };

  const handleLogout = () => {
    const t = tok();
    if (t) fetch(`${API}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    try { ['gharka_token', 'gharka_user_email', 'gharka_user_name'].forEach(k => localStorage.removeItem(k)); } catch {}
    router.push('/');
  };

  const toggleGoal = (g: string) =>
    setBody(b => ({ ...b, health_goals: b.health_goals.includes(g) ? b.health_goals.filter(x => x !== g) : [...b.health_goals, g] }));

  const initials = (user?.full_name || user?.email || 'U').trim().charAt(0).toUpperCase();
  const isChef = !!(user?.user_type && CHEF_TYPES.includes(user.user_type));

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 60px', fontFamily: 'inherit', color: 'var(--text-primary,#F5EFE6)' }}>
      {cropFile && <CropModal file={cropFile} onConfirm={handleCropConfirm} onCancel={() => setCropFile(null)} />}

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 18, color: 'var(--text-primary,#F5EFE6)' }}>My Profile</h2>

      {/* ── Profile hero ── */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: '#3a3026', border: '3px solid rgba(249,115,22,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
          >
            {avatarUrl
              ? <img src={`${API}${avatarUrl}`} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 30, fontWeight: 700, color: '#F97316' }}>{initials}</span>}
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, color: '#fff' }}>…</span>
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: '50%', background: '#F97316', border: '2px solid var(--bg-base,#131110)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11 }}
          >📷</button>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarFile} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name || 'Loading…'}</p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary,rgba(255,255,255,0.45))', margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 99, background: isChef ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.07)', color: isChef ? '#F97316' : 'rgba(255,255,255,0.4)', border: `1px solid ${isChef ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.12)'}` }}>
            {user?.user_type || 'User'}
          </span>
        </div>

        {isChef && (
          <button
            onClick={() => router.push('/chef-dashboard')}
            style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 9, border: '1px solid rgba(249,115,22,0.3)', background: 'rgba(249,115,22,0.08)', color: '#F97316', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >🍳 Dashboard</button>
        )}
      </div>

      {/* ── Personal Information ── */}
      <div style={card}>
        <p style={cardH}><span>👤</span> Personal Information</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Full Name</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Email</label>
            <input style={inpDis} value={user?.email || ''} disabled />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 00000 00000" />
          </div>
          <div>
            <label style={lbl}>Gender</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">Select…</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Address ── */}
      <div style={card}>
        <p style={cardH}><span>📍</span> Address</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Address Line 1</label>
            <input style={inp} value={addrLine1} onChange={e => setAddrLine1(e.target.value)} placeholder="Flat / House number, Street" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Address Line 2</label>
            <input style={inp} value={addrLine2} onChange={e => setAddrLine2(e.target.value)} placeholder="Building / Complex name (optional)" />
          </div>
          <div>
            <label style={lbl}>City</label>
            <input style={inp} value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
          </div>
          <div>
            <label style={lbl}>Postcode</label>
            <input style={inp} value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="Postcode / PIN" />
          </div>
          <div>
            <label style={lbl}>Latitude</label>
            <input style={inp} value={lat} onChange={e => setLat(e.target.value)} placeholder="e.g. 51.5074" />
          </div>
          <div>
            <label style={lbl}>Longitude</label>
            <input style={inp} value={lng} onChange={e => setLng(e.target.value)} placeholder="e.g. -0.1278" />
          </div>
        </div>
        <button
          onClick={geocodeAddress}
          disabled={geocoding}
          style={{ ...btn, background: 'rgba(249,115,22,0.12)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)', padding: '7px 16px', fontWeight: 600 }}
        >
          {geocoding ? '⏳ Locating…' : '📍 Auto-detect coordinates from address'}
        </button>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Uses address fields above to fill latitude &amp; longitude automatically.</p>
      </div>

      {/* ── Body & Lifestyle ── */}
      <div style={card}>
        <p style={cardH}><span>💪</span> Body &amp; Lifestyle</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 14, lineHeight: 1.6 }}>
          This information helps AI personalise meal plans and recipe suggestions for your health goals.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Height (cm)</label>
            <input type="number" min="50" max="250" style={inp} value={body.height_cm}
              onChange={e => setBody(b => ({ ...b, height_cm: e.target.value }))} placeholder="e.g. 170" />
          </div>
          <div>
            <label style={lbl}>Weight (kg)</label>
            <input type="number" min="20" max="500" style={inp} value={body.weight_kg}
              onChange={e => setBody(b => ({ ...b, weight_kg: e.target.value }))} placeholder="e.g. 70" />
          </div>
          <div>
            <label style={lbl}>Date of Birth</label>
            <input type="date" style={{ ...inp, colorScheme: 'dark' }} value={body.date_of_birth}
              onChange={e => setBody(b => ({ ...b, date_of_birth: e.target.value }))} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Activity Level</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {ACTIVITY_LEVELS.map(level => {
              const active = body.activity_level === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setBody(b => ({ ...b, activity_level: active ? '' : level }))}
                  style={{
                    padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.06)',
                    color: active ? '#F97316' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${active ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    fontWeight: active ? 600 : 400,
                  }}
                >{level}</button>
              );
            })}
          </div>
        </div>

        <div>
          <label style={lbl}>Health Goals <span style={{ opacity: 0.5, fontWeight: 400 }}>(select all that apply)</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {HEALTH_GOALS.map(goal => {
              const active = body.health_goals.includes(goal);
              return (
                <button
                  key={goal}
                  type="button"
                  onClick={() => toggleGoal(goal)}
                  style={{
                    padding: '5px 12px', fontSize: 12, borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                    color: active ? '#4ade80' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${active ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    fontWeight: active ? 600 : 400,
                  }}
                >{goal}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button style={{ ...btn, padding: '10px 28px' }} disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>
        {msg && <span style={{ fontSize: 12, color: msg === 'Saved!' ? '#4ADE80' : '#F87171' }}>{msg}</span>}
      </div>

      {/* ── Chef section ── */}
      {isChef ? (
        <div style={{ ...card, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.04)' }}>
          <p style={cardH}><span>👨‍🍳</span> Chef Profile</p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary,rgba(255,255,255,0.5))', marginBottom: 14, lineHeight: 1.6 }}>
            Manage your public chef profile, recipes, analytics and branding from the Chef Dashboard.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/chef-dashboard')} style={{ ...btn, flex: 1, padding: '9px 16px' }}>
              🍳 Chef Dashboard
            </button>
            <button onClick={() => router.push('/chef-dashboard/profile')}
              style={{ ...btn, flex: 1, padding: '9px 16px', background: 'transparent', border: '1px solid rgba(249,115,22,0.35)', color: '#F97316' }}>
              ✏️ Edit Chef Profile
            </button>
          </div>
        </div>
      ) : !chefSuccess ? (
        <div style={{ ...card, border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.04)' }}>
          <p style={cardH}><span>👨‍🍳</span> Become a Chef on Gharka</p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary,rgba(255,255,255,0.5))', marginBottom: 14, lineHeight: 1.6 }}>
            Create your public chef profile, showcase recipes, get featured in search, and access the chef dashboard.
          </p>
          <label style={lbl}>Choose your profile URL</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>gharka.com/chef/</span>
            <input
              style={{ ...inp, flex: 1 }}
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="your-chef-name"
            />
          </div>
          {slug.length > 0 && slug.length < 3 && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Min 3 characters</p>}
          {slug.length >= 3 && (
            <p style={{ fontSize: 11, marginBottom: 10, color: slugStatus === 'available' ? '#4ADE80' : slugStatus === 'taken' ? '#F87171' : 'rgba(255,255,255,0.4)' }}>
              {slugStatus === 'checking' && '⏳ Checking…'}
              {slugStatus === 'available' && '✓ Available!'}
              {slugStatus === 'taken' && '✗ Already taken'}
            </p>
          )}
          <button
            style={{ ...btn, width: '100%', padding: '10px', opacity: slugStatus !== 'available' || becomingChef ? 0.5 : 1 }}
            disabled={slugStatus !== 'available' || becomingChef}
            onClick={handleBecomeChef}
          >{becomingChef ? 'Setting up…' : '🍳 Create Chef Profile'}</button>
        </div>
      ) : (
        <div style={{ ...card, border: '1px solid rgba(74,222,128,0.25)', background: 'rgba(74,222,128,0.05)', textAlign: 'center' }}>
          <p style={{ fontSize: 20, margin: '0 0 6px' }}>👨‍🍳</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#4ADE80', margin: '0 0 4px' }}>Chef Profile Created!</p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary,rgba(255,255,255,0.45))', marginBottom: 14 }}>Manage recipes, analytics and your public page from the dashboard.</p>
          <button onClick={() => router.push('/chef-dashboard')} style={{ ...btn, width: '100%', padding: '10px', background: '#22c55e' }}>Go to Chef Dashboard →</button>
        </div>
      )}

      {/* ── Upgrade to Pro ── */}
      <div style={card}>
        <p style={cardH}><span>✦</span> Gharka Pro</p>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary,rgba(255,255,255,0.45))', marginBottom: 12, lineHeight: 1.6 }}>
          Unlimited recipe history, priority AI, infographic cards, and upcoming Phase 2 &amp; 3 features.
        </p>
        <button style={{ ...btn, width: '100%', padding: '10px', background: 'linear-gradient(135deg,#f97316,#ef4444)' }}>
          ✦ Upgrade to Pro
        </button>
      </div>

      {/* ── Logout ── */}
      <button
        onClick={handleLogout}
        style={{ width: '100%', padding: '10px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: '#F87171', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
      >🚪 Log Out</button>
    </div>
  );
}
