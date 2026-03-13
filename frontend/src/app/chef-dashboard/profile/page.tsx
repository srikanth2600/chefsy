'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useChefTheme } from '@/components/chef/ChefThemeContext';
import { Avatar, Btn, SLabel } from '@/components/chef/ui';
import type { AppearanceTheme } from '@/components/chef/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

const DEFAULT_THEME: AppearanceTheme = {
  banner_color: '#DA7756', accent_color: '#DA7756', font: 'Georgia, serif', bg_style: 'dark',
};

const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon, children, t }: { title: string; icon: string; children: React.ReactNode; t: any }) {
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </p>
      {children}
    </div>
  );
}

// ─── Crop Modal ───────────────────────────────────────────────────────────────
function CropModal({ file, aspectRatio, onConfirm, onCancel, t }: {
  file: File; aspectRatio: number; onConfirm: (blob: Blob) => void; onCancel: () => void; t: any;
}) {
  const [imgSrc, setImgSrc] = useState('');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

  const DISPLAY_W = 460;
  const DISPLAY_H = Math.round(DISPLAY_W / aspectRatio);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = e => setImgSrc(e.target?.result as string);
    reader.readAsDataURL(file);
  }, [file]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    setNaturalSize({ w: nw, h: nh });
    const minScale = Math.max(DISPLAY_W / nw, DISPLAY_H / nh);
    setScale(minScale);
    setOffset({ x: 0, y: 0 });
  };

  const clampOffset = (ox: number, oy: number, sc: number) => {
    const scaledW = naturalSize.w * sc;
    const scaledH = naturalSize.h * sc;
    return {
      x: Math.max(Math.min(0, DISPLAY_W - scaledW), Math.min(0, ox)),
      y: Math.max(Math.min(0, DISPLAY_H - scaledH), Math.min(0, oy)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const ox = e.clientX - dragStart.x;
    const oy = e.clientY - dragStart.y;
    setOffset(clampOffset(ox, oy, scale));
  };
  const handleScaleChange = (sc: number) => {
    setScale(sc);
    setOffset(o => clampOffset(o.x, o.y, sc));
  };

  const handleConfirm = () => {
    const canvas = document.createElement('canvas');
    const outW = aspectRatio === 1 ? 400 : 1200;
    const outH = Math.round(outW / aspectRatio);
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      const srcX = -offset.x / scale;
      const srcY = -offset.y / scale;
      const srcW = DISPLAY_W / scale;
      const srcH = DISPLAY_H / scale;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      canvas.toBlob(blob => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.92);
    };
    img.src = imgSrc;
  };

  const minScale = Math.max(DISPLAY_W / naturalSize.w, DISPLAY_H / naturalSize.h);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.bgCard, borderRadius: 16, padding: 20, width: '100%', maxWidth: 520 }}>
        <p style={{ color: t.textPrimary, fontWeight: 700, fontSize: 14, margin: '0 0 12px' }}>Crop Image</p>
        <p style={{ color: t.textTertiary, fontSize: 11, margin: '0 0 10px' }}>Drag to reposition · Use slider to zoom</p>
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
          style={{
            width: '100%', aspectRatio: String(aspectRatio), overflow: 'hidden',
            cursor: dragging ? 'grabbing' : 'grab', position: 'relative',
            borderRadius: aspectRatio === 1 ? '50%' : 10,
            border: `2px solid ${t.border}`, background: '#111',
          }}
        >
          {imgSrc && (
            <img
              src={imgSrc} onLoad={onImgLoad} draggable={false}
              style={{
                width: naturalSize.w * scale, height: naturalSize.h * scale,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                display: 'block', userSelect: 'none', pointerEvents: 'none',
              }}
            />
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <SLabel t={t}>Zoom</SLabel>
          <input type="range" min={minScale} max={minScale * 4} step={0.01} value={scale}
            onChange={e => handleScaleChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: t.accent }} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
          <button onClick={handleConfirm} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: t.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>Crop & Upload</button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload tile with crop ────────────────────────────────────────────────────
function UploadTile({
  label, hint, url, ratio, aspectRatio, onUpload, uploadEndpoint, t,
}: {
  label: string; hint: string; url: string | null; ratio: string; aspectRatio: number;
  onUpload: (url: string) => void; uploadEndpoint: string; t: any;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);

  const handleFile = (file: File) => {
    setErr('');
    setCropFile(file);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, 'image.jpg');
      const r = await fetch(`${API}${uploadEndpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok()}` },
        body: fd,
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${r.status}`); }
      const data = await r.json();
      onUpload(data.url);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  };

  const isSquare = ratio === '1/1';

  return (
    <div>
      {cropFile && (
        <CropModal file={cropFile} aspectRatio={aspectRatio} onConfirm={handleCropConfirm} onCancel={() => setCropFile(null)} t={t} />
      )}
      <SLabel t={t}>{label}</SLabel>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          aspectRatio: ratio, borderRadius: isSquare ? '50%' : 12,
          border: `2px dashed ${t.borderAcc}`, background: url ? 'none' : t.bgSurface,
          cursor: uploading ? 'wait' : 'pointer', position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          maxWidth: isSquare ? 96 : '100%', transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = t.accent)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = t.borderAcc)}
      >
        {url && (
          <img src={url.startsWith('/media') ? `${API}${url}` : url}
            alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <div style={{
          position: 'absolute', inset: 0, background: url ? 'rgba(0,0,0,0.45)' : 'transparent',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          opacity: url ? 0 : 1, transition: 'opacity 0.2s',
        }}
          onMouseEnter={e => url && (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => url && (e.currentTarget.style.opacity = '0')}
        >
          <span style={{ fontSize: isSquare ? 22 : 28, marginBottom: 4 }}>{uploading ? '⏳' : '📷'}</span>
          <span style={{ fontSize: 10, color: url ? '#fff' : t.textTertiary, textAlign: 'center', padding: '0 8px' }}>
            {uploading ? 'Uploading…' : url ? 'Click to change' : 'Click to upload'}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 10, color: t.textTertiary, margin: '4px 0 0' }}>{hint}</p>
      {err && <p style={{ fontSize: 10, color: t.error, margin: '3px 0 0' }}>{err}</p>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}

// ─── Rich text bio editor ─────────────────────────────────────────────────────
function RichBio({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInit = useRef(false);

  useEffect(() => {
    if (ref.current && !isInit.current && value) {
      ref.current.innerHTML = value;
      isInit.current = true;
    }
  }, [value]);

  const cmd = (command: string, val?: string) => {
    document.execCommand(command, false, val);
    ref.current?.focus();
    onChange(ref.current?.innerHTML || '');
  };

  const toolbarBtns: [string, string, string?, string?][] = [
    ['Bold', 'bold', 'B', undefined],
    ['Italic', 'italic', 'I', undefined],
    ['Underline', 'underline', 'U', undefined],
    ['|', '', undefined, undefined],
    ['Bullet list', 'insertUnorderedList', '• List', undefined],
    ['Numbered list', 'insertOrderedList', '1. List', undefined],
    ['|', '', undefined, undefined],
    ['Heading', 'formatBlock', 'H2', 'h2'],
    ['Normal', 'formatBlock', 'Normal', 'p'],
  ];

  const btnStyle = (): React.CSSProperties => ({
    padding: '4px 8px', fontSize: 12, borderRadius: 6, border: `1px solid ${t.border}`,
    background: t.bgSurface, color: t.textPrimary, cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 600, lineHeight: 1,
  });

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px', background: t.bgSurface, borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap' }}>
        {toolbarBtns.map(([title, command, label, val], i) =>
          title === '|' ? (
            <span key={i} style={{ width: 1, background: t.border, margin: '0 2px', alignSelf: 'stretch' }} />
          ) : (
            <button key={i} title={title} style={btnStyle()} onMouseDown={e => { e.preventDefault(); cmd(command, val); }}>
              {label}
            </button>
          )
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || '')}
        style={{
          minHeight: 200, padding: '12px 14px', color: t.textPrimary, fontSize: 14,
          lineHeight: 1.8, outline: 'none', background: t.bgInput, fontFamily: 'inherit',
        }}
        data-placeholder="Tell your story, cooking philosophy, specialities…"
      />
      <style>{`[contenteditable]:empty:before{content:attr(data-placeholder);color:${t.textTertiary};pointer-events:none;}`}</style>
    </div>
  );
}

// ─── Tag list (add / delete items) ────────────────────────────────────────────
function TagList({ items, onChange, placeholder, t }: {
  items: string[]; onChange: (items: string[]) => void; placeholder?: string; t: any;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) { onChange([...items, v]); }
    setInput('');
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {items.map((item, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: t.accentBg, color: t.accent, borderRadius: 20,
              padding: '4px 10px', fontSize: 12, fontWeight: 600,
            }}>
              {item}
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.accent, padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder || 'Type and press Enter or Add'}
          style={{
            flex: 1, padding: '8px 11px', borderRadius: 10, border: `1px solid ${t.border}`,
            background: t.bgInput, color: t.textPrimary, fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={add} style={{
          padding: '8px 14px', borderRadius: 10, border: 'none',
          background: t.accent, color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
        }}>+ Add</button>
      </div>
    </div>
  );
}

// ─── Multi-select dropdown ─────────────────────────────────────────────────────
function MultiDropdown({ items, selected, onChange, placeholder, t }: {
  items: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  t: any;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const selectedNames = items.filter(i => selected.includes(i.id)).map(i => i.name);
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '8px 11px', borderRadius: 10, border: `1px solid ${open ? t.accent : t.border}`,
          background: t.bgInput, color: selectedNames.length ? t.textPrimary : t.textTertiary,
          fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedNames.length ? selectedNames.join(', ') : (placeholder || 'Select…')}
        </span>
        <span style={{ fontSize: 10, marginLeft: 6, color: t.textTertiary }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 10,
          marginTop: 4, maxHeight: 240, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', padding: '5px 8px', borderRadius: 7, border: `1px solid ${t.border}`,
                background: t.bgInput, color: t.textPrimary, fontSize: 12, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 && (
              <p style={{ padding: '10px 12px', fontSize: 12, color: t.textTertiary, margin: 0 }}>No results</p>
            )}
            {filtered.map(item => {
              const on = selected.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  style={{
                    padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                    background: on ? t.accentBg : t.bgCard, color: on ? t.accent : t.textPrimary,
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: `1px solid ${t.border}`,
                  }}
                  onMouseEnter={e => !on && (e.currentTarget.style.background = t.bgSurface)}
                  onMouseLeave={e => !on && (e.currentTarget.style.background = t.bgCard)}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: 4, border: `2px solid ${on ? t.accent : t.border}`,
                    background: on ? t.accent : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#fff', flexShrink: 0,
                  }}>{on ? '✓' : ''}</span>
                  {item.name}
                </div>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div style={{ padding: '6px 10px', borderTop: `1px solid ${t.border}`, fontSize: 11, color: t.textTertiary }}>
              {selected.length} selected · <button onClick={() => onChange([])} style={{ background: 'none', border: 'none', color: t.accent, cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: 'inherit' }}>Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function FI({ label, value, onChange, placeholder, type, readonly, t }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; readonly?: boolean; t: any;
}) {
  const fi: React.CSSProperties = {
    width: '100%', padding: '8px 11px', borderRadius: 10, border: `1px solid ${t.border}`,
    background: readonly ? t.bgSurface : t.bgInput, color: readonly ? t.textSecondary : t.textPrimary,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    cursor: readonly ? 'default' : undefined,
  };
  return (
    <div>
      <SLabel t={t}>{label}</SLabel>
      <input type={type || 'text'} value={value} readOnly={readonly}
        onChange={e => onChange?.(e.target.value)} placeholder={placeholder} style={fi} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfileEditPage() {
  const { t, isDark } = useChefTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Account (read-only from users table)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [slug, setSlug] = useState('');
  const [gender, setGender] = useState('');

  // Avatar / Banner
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState('#DA7756');

  // Roles & Categories
  const [allRoles, setAllRoles] = useState<{ id: number; name: string }[]>([]);
  const [allCategories, setAllCategories] = useState<{ id: number; name: string }[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  // Professional
  const [speciality, setSpeciality] = useState('');
  const [experience, setExperience] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);

  // Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [postcode, setPostcode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geoMsg, setGeoMsg] = useState('');

  // Bio
  const [bio, setBio] = useState('');

  // Appearance
  const [appTheme, setAppTheme] = useState<AppearanceTheme>(DEFAULT_THEME);

  // Social
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [website, setWebsite] = useState('');

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t2 = tok();
    if (!t2) { setLoading(false); return; }
    const h = { Authorization: `Bearer ${t2}` };
    const p1 = fetch(`${API}/chefs/me/profile`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setName(d.name || '');
        setEmail(d.email || '');
        setPhone(d.phone || '');
        setSlug(d.slug || '');
        setGender(d.gender || '');
        setAvatarUrl(d.avatar_url || null);
        setBannerUrl(d.banner_url || null);
        setAvatarColor(d.avatar_color || '#DA7756');
        setSpeciality(d.cuisine_speciality || '');
        setExperience(String(d.experience_years || ''));
        setCertifications(Array.isArray(d.certifications) ? d.certifications : []);
        setAddressLine1(d.address_line1 || '');
        setAddressLine2(d.address_line2 || '');
        setStreet(d.street || '');
        setCity(d.city || '');
        setCounty(d.county || '');
        setPostcode(d.postcode || '');
        setLatitude(d.latitude ?? null);
        setLongitude(d.longitude ?? null);
        setBio(d.bio || '');
        if (d.appearance_theme) setAppTheme(d.appearance_theme);
        setInstagram(d.instagram_url || '');
        setYoutube(d.youtube_url || '');
        setWebsite(d.website_url || '');
      }).catch(() => {});
    const p2 = fetch(`${API}/chefs/roles`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.roles) setAllRoles(d.roles); }).catch(() => {});
    const p3 = fetch(`${API}/chefs/categories`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.categories) setAllCategories(d.categories); }).catch(() => {});
    const p4 = fetch(`${API}/chefs/me/roles`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.roles) setSelectedRoles(d.roles.map((r: any) => r.id)); }).catch(() => {});
    const p5 = fetch(`${API}/chefs/me/categories`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.categories) setSelectedCategories(d.categories.map((c: any) => c.id)); }).catch(() => {});
    Promise.all([p1, p2, p3, p4, p5]).finally(() => setLoading(false));
  }, []);

  // ── Geocode address ────────────────────────────────────────────────────────
  const handleGeocode = async () => {
    if (![addressLine1, addressLine2, street, city, county, postcode].some(Boolean)) {
      setGeoMsg('Please fill in at least one address field.'); return;
    }
    setGeocoding(true); setGeoMsg('');
    // Try queries from simplest → most specific for best results
    const candidates = [
      [city, postcode].filter(Boolean).join(', '),
      [city, county, postcode].filter(Boolean).join(', '),
      [street, city, county, postcode].filter(Boolean).join(', '),
      [addressLine1, street, city, county, postcode].filter(Boolean).join(', '),
    ].filter(q => q.trim().length > 0);
    const unique = [...new Set(candidates)];
    try {
      for (const q of unique) {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'GharkaChef/1.0' } });
        const data = await res.json();
        if (data.length) {
          setLatitude(parseFloat(data[0].lat));
          setLongitude(parseFloat(data[0].lon));
          setGeoMsg(`✓ Location confirmed: ${data[0].display_name.slice(0, 80)}…`);
          return;
        }
      }
      setGeoMsg('Address not found. Try entering just the city and postcode.');
    } catch {
      setGeoMsg('Could not connect to geocoding service.');
    } finally {
      setGeocoding(false);
    }
  };

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    const t2 = tok();
    if (!t2) { alert('Please log in'); return; }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        cuisine_speciality: speciality || null,
        experience_years: experience ? parseInt(experience) : null,
        bio: bio || null,
        certifications,
        gender: gender || null,
        avatar_color: avatarColor,
        instagram_url: instagram || null,
        youtube_url: youtube || null,
        website_url: website || null,
        appearance_theme: appTheme,
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        street: street || null,
        city: city || null,
        county: county || null,
        postcode: postcode || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      };
      const r = await fetch(`${API}/chefs/me/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      await fetch(`${API}/chefs/me/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
        body: JSON.stringify({ role_ids: selectedRoles }),
      }).catch(() => {});

      await fetch(`${API}/chefs/me/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
        body: JSON.stringify({ category_ids: selectedCategories }),
      }).catch(() => {});

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const fi: React.CSSProperties = {
    width: '100%', padding: '8px 11px', borderRadius: 10, border: `1px solid ${t.border}`,
    background: t.bgInput, color: t.textPrimary, fontSize: 13,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };
  const sel: React.CSSProperties = { ...fi, colorScheme: isDark ? 'dark' : 'light', appearance: 'auto' };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>
        Loading profile…
      </div>
    );
  }

  return (
    <div style={{ background: t.bg, minHeight: '100%' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 18px 100px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: t.textPrimary, margin: 0 }}>Edit Profile</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && <span style={{ fontSize: 12, color: t.success, fontWeight: 600 }}>✓ Saved!</span>}
            <Btn t={t} onClick={handleSave} style={{ minWidth: 90 }}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </div>

        {/* ── Public URL banner ── */}
        {slug && (
          <div style={{ background: t.bgCard, border: `1px solid ${t.borderAcc}`, borderRadius: 11, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: t.textTertiary }}>🌐 Your public URL:</span>
            <code style={{ fontSize: 12, color: t.accent, fontFamily: 'monospace', fontWeight: 700 }}>{slug}.gharkachef.com</code>
            <button onClick={() => router.push(`/chef/${slug}`)} style={{ marginLeft: 'auto', fontSize: 11, color: t.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Preview ↗</button>
          </div>
        )}

        {/* ── 1. Account Information ── */}
        <Section title="Account Information" icon="🔐" t={t}>
          <p style={{ fontSize: 11, color: t.textTertiary, margin: '-6px 0 12px' }}>
            These details come from your registration. To change email or phone, contact support.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FI label="Full Name" value={name} readonly t={t} />
            <FI label="Email" value={email} readonly t={t} />
            <FI label="Phone" value={phone || '—'} readonly t={t} />
            <FI label="Profile Handle (URL slug)" value={slug} readonly t={t} />
            <div>
              <SLabel t={t}>Gender</SLabel>
              <select value={gender} onChange={e => setGender(e.target.value)} style={sel}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </Section>

        {/* ── 2. Photo & Banner ── */}
        <Section title="Profile Photo & Banner" icon="🖼" t={t}>
          <div style={{ display: 'grid', gridTemplateColumns: '116px 1fr', gap: 16, alignItems: 'start' }}>
            <UploadTile
              label="Profile Photo"
              hint="JPG/PNG/WebP · Max 2 MB · 1:1 square"
              url={avatarUrl} ratio="1/1" aspectRatio={1}
              onUpload={setAvatarUrl} uploadEndpoint="/chefs/me/avatar" t={t}
            />
            <UploadTile
              label="Banner Image"
              hint="JPG/PNG/WebP · Max 5 MB · Recommended 1200×400 px (3:1)"
              url={bannerUrl} ratio="3/1" aspectRatio={3}
              onUpload={setBannerUrl} uploadEndpoint="/chefs/me/banner" t={t}
            />
          </div>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <SLabel t={t}>Avatar Fallback Colour</SLabel>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={avatarColor} onChange={e => setAvatarColor(e.target.value)}
                  style={{ width: 40, height: 34, borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2, background: 'none' }} />
                <span style={{ fontSize: 11, color: t.textSecondary, fontFamily: 'monospace' }}>{avatarColor}</span>
                <Avatar name={name || '?'} color={avatarColor} size={36} radius={10} />
              </div>
            </div>
          </div>
        </Section>

        {/* ── 3. Professional Details ── */}
        <Section title="Professional Details" icon="🍳" t={t}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 12 }}>
            <div>
              <SLabel t={t}>Cuisine Speciality</SLabel>
              <textarea
                value={speciality}
                onChange={e => setSpeciality(e.target.value)}
                placeholder="e.g. Hyderabadi, Italian, South Indian, Bakery, Street Food — describe all your specialities"
                rows={3}
                style={{ ...fi, resize: 'vertical', minHeight: 72 }}
              />
            </div>
            <div>
              <SLabel t={t}>Experience (yrs)</SLabel>
              <input type="number" min={0} value={experience} onChange={e => setExperience(e.target.value)} style={fi} placeholder="0" />
            </div>
          </div>

          {/* Certifications */}
          <div style={{ marginBottom: 12 }}>
            <SLabel t={t}>Certifications & Awards</SLabel>
            <p style={{ fontSize: 11, color: t.textTertiary, margin: '0 0 6px' }}>Add each certificate or award individually.</p>
            <TagList items={certifications} onChange={setCertifications} placeholder="e.g. Culinary Arts Diploma" t={t} />
          </div>

          {/* Roles */}
          <div style={{ marginBottom: 12 }}>
            <SLabel t={t}>Roles (select all that apply)</SLabel>
            {allRoles.length === 0
              ? <p style={{ fontSize: 11, color: t.textTertiary }}>No roles available yet — admin needs to add them.</p>
              : <MultiDropdown items={allRoles} selected={selectedRoles} onChange={setSelectedRoles} placeholder="Select roles…" t={t} />
            }
          </div>

          {/* Categories */}
          <div>
            <SLabel t={t}>Categories</SLabel>
            {allCategories.length === 0
              ? <p style={{ fontSize: 11, color: t.textTertiary }}>No categories available yet — admin needs to add them.</p>
              : <MultiDropdown items={allCategories} selected={selectedCategories} onChange={setSelectedCategories} placeholder="Select categories…" t={t} />
            }
          </div>
        </Section>

        {/* ── 4. Location / Address ── */}
        <Section title="Location & Address" icon="📍" t={t}>
          <p style={{ fontSize: 11, color: t.textTertiary, margin: '-6px 0 12px' }}>
            Fill in your address then click Confirm Location to save coordinates.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <SLabel t={t}>Address Line 1</SLabel>
              <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} placeholder="Flat / House number" style={fi} />
            </div>
            <div>
              <SLabel t={t}>Address Line 2</SLabel>
              <input value={addressLine2} onChange={e => setAddressLine2(e.target.value)} placeholder="Building / Complex name" style={fi} />
            </div>
            <div>
              <SLabel t={t}>Street</SLabel>
              <input value={street} onChange={e => setStreet(e.target.value)} placeholder="Street name" style={fi} />
            </div>
            <div>
              <SLabel t={t}>City</SLabel>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={fi} />
            </div>
            <div>
              <SLabel t={t}>County / State</SLabel>
              <input value={county} onChange={e => setCounty(e.target.value)} placeholder="County or State" style={fi} />
            </div>
            <div>
              <SLabel t={t}>Post Code</SLabel>
              <input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="Postcode / ZIP" style={fi} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={handleGeocode} style={{
              padding: '8px 16px', borderRadius: 10, border: `1px solid ${t.border}`,
              background: t.bgSurface, color: t.textPrimary, cursor: geocoding ? 'wait' : 'pointer',
              fontSize: 13, fontFamily: 'inherit',
            }}>
              {geocoding ? '📍 Finding…' : '📍 Confirm Location'}
            </button>
            {(latitude !== null && longitude !== null) && (
              <span style={{ fontSize: 11, color: t.textTertiary, fontFamily: 'monospace' }}>
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </span>
            )}
          </div>
          {geoMsg && (
            <p style={{ fontSize: 11, marginTop: 8, color: geoMsg.startsWith('✓') ? t.success : t.error }}>{geoMsg}</p>
          )}
        </Section>

        {/* ── 5. Bio ── */}
        <Section title="Bio" icon="📝" t={t}>
          <p style={{ fontSize: 11, color: t.textTertiary, margin: '-6px 0 10px' }}>
            Use the toolbar to add bold text, headings, and bullet points.
          </p>
          <RichBio value={bio} onChange={setBio} t={t} />
        </Section>

        {/* ── 6. Profile Appearance ── */}
        <Section title="Profile Appearance" icon="🎨" t={t}>
          <p style={{ fontSize: 11, color: t.textTertiary, margin: '-6px 0 12px' }}>
            Customise how your public chef profile looks to visitors.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <SLabel t={t}>Banner Colour</SLabel>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={appTheme.banner_color}
                  onChange={e => setAppTheme(th => ({ ...th, banner_color: e.target.value }))}
                  style={{ width: 40, height: 34, borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2, background: 'none' }} />
                <span style={{ fontSize: 11, color: t.textSecondary, fontFamily: 'monospace' }}>{appTheme.banner_color}</span>
              </div>
            </div>
            <div>
              <SLabel t={t}>Accent Colour</SLabel>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={appTheme.accent_color}
                  onChange={e => setAppTheme(th => ({ ...th, accent_color: e.target.value }))}
                  style={{ width: 40, height: 34, borderRadius: 8, border: `1px solid ${t.border}`, cursor: 'pointer', padding: 2, background: 'none' }} />
                <span style={{ fontSize: 11, color: t.textSecondary, fontFamily: 'monospace' }}>{appTheme.accent_color}</span>
              </div>
            </div>
            <div>
              <SLabel t={t}>Font Style</SLabel>
              <select value={appTheme.font} onChange={e => setAppTheme(th => ({ ...th, font: e.target.value }))} style={sel}>
                <option value="Georgia, serif">Georgia (Classic)</option>
                <option value="system-ui, sans-serif">Sans-serif (Modern)</option>
                <option value="'Courier New', monospace">Monospace</option>
                <option value="cursive">Cursive (Elegant)</option>
              </select>
            </div>
            <div>
              <SLabel t={t}>Background Style</SLabel>
              <select value={appTheme.bg_style} onChange={e => setAppTheme(th => ({ ...th, bg_style: e.target.value as AppearanceTheme['bg_style'] }))} style={sel}>
                <option value="dark">Dark (Default)</option>
                <option value="warm">Warm Brown</option>
                <option value="forest">Forest Green</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12, borderRadius: 11, overflow: 'hidden', border: `1px solid ${t.border}` }}>
            <div style={{ height: 54, background: `linear-gradient(135deg,${appTheme.banner_color}55,${appTheme.banner_color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#fff', fontFamily: appTheme.font, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                Banner Preview · {name}
              </span>
            </div>
          </div>
        </Section>

        {/* ── 7. Social Links ── */}
        <Section title="Social Links" icon="🔗" t={t}>
          {([
            ['📸 Instagram', 'username (no @)', instagram, setInstagram],
            ['▶ YouTube', 'Channel URL', youtube, setYoutube],
            ['🌐 Website', 'https://yoursite.com', website, setWebsite],
          ] as const).map(([label, placeholder, value, setter]) => (
            <div key={String(label)} style={{ marginBottom: 10 }}>
              <SLabel t={t}>{String(label)}</SLabel>
              <input value={String(value)} onChange={e => (setter as (v: string) => void)(e.target.value)}
                placeholder={String(placeholder)} style={fi} />
            </div>
          ))}
        </Section>

        {/* ── Bottom save ── */}
        <Btn t={t} onClick={handleSave} style={{ width: '100%', padding: '13px', fontSize: 14 }}>
          {saving ? 'Saving…' : '✓ Save Profile'}
        </Btn>
      </div>
    </div>
  );
}
