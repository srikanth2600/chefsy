'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChefTheme } from '@/components/chef/ChefThemeContext';
import { Btn, SLabel, Card, ThemeToggle, fmtN, Pill } from '@/components/chef/ui';
import type { RecipeIngredient } from '@/components/chef/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

// ─── Custom Select (replaces native <select> to fix dark-mode dropdown) ───────
function CustomSelect({ value, onChange, options, placeholder, style }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const { t } = useChefTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', borderRadius: 10, border: `1px solid ${open ? t.accent : t.border}`, background: t.bgInput, color: selected ? t.textPrimary : t.textTertiary, fontSize: 13, cursor: 'pointer', userSelect: 'none', fontFamily: 'inherit', gap: 8 }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected?.label || placeholder || 'Select…'}</span>
        <span style={{ fontSize: 9, color: t.textTertiary, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.40)', maxHeight: 220, overflowY: 'auto' }}>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{ padding: '9px 13px', fontSize: 13, color: opt.value === value ? t.accent : t.textPrimary, background: opt.value === value ? t.accentBg : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = t.bgSurface; }}
              onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Image Crop Modal ─────────────────────────────────────────────────────────
function CropModal({ src, onApply, onCancel, t }: {
  src: string;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
  t: any;
}) {
  const imgRef    = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging  = useRef(false);
  const startPos  = useRef({ x: 0, y: 0 });

  const [imgLoaded, setImgLoaded] = useState(false);
  const [aspect, setAspect]       = useState<number | null>(null);
  const [crop, setCrop]           = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const getImgRect = () => {
    if (!imgRef.current || !overlayRef.current) return null;
    const ib = imgRef.current.getBoundingClientRect();
    const ob = overlayRef.current.getBoundingClientRect();
    return { x: ib.left - ob.left, y: ib.top - ob.top, w: ib.width, h: ib.height };
  };

  // Default crop = full image
  useEffect(() => {
    if (!imgLoaded) return;
    setTimeout(() => {
      const r = getImgRect();
      if (r) setCrop({ x: r.x, y: r.y, w: r.w, h: r.h });
    }, 50);
  }, [imgLoaded]);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const onMouseDown = (e: React.MouseEvent) => {
    const ob = overlayRef.current!.getBoundingClientRect();
    const x = e.clientX - ob.left;
    const y = e.clientY - ob.top;
    startPos.current = { x, y };
    setCrop({ x, y, w: 0, h: 0 });
    dragging.current = true;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const ob = overlayRef.current!.getBoundingClientRect();
    const ir = getImgRect();
    if (!ir) return;
    let x = clamp(e.clientX - ob.left, ir.x, ir.x + ir.w);
    let y = clamp(e.clientY - ob.top,  ir.y, ir.y + ir.h);
    let w = x - startPos.current.x;
    let h = y - startPos.current.y;
    if (aspect !== null && w !== 0) {
      h = (Math.abs(w) / aspect) * Math.sign(h || 1);
    }
    const nx = w < 0 ? startPos.current.x + w : startPos.current.x;
    const ny = h < 0 ? startPos.current.y + h : startPos.current.y;
    setCrop({ x: nx, y: ny, w: Math.abs(w), h: Math.abs(h) });
  };

  const onMouseUp = () => { dragging.current = false; };

  const applyCrop = () => {
    if (!imgRef.current || !canvasRef.current || !crop || crop.w < 10) return;
    const img = imgRef.current;
    const ir  = getImgRect();
    if (!ir) return;
    const scaleX = img.naturalWidth  / ir.w;
    const scaleY = img.naturalHeight / ir.h;
    const sx = (crop.x - ir.x) * scaleX;
    const sy = (crop.y - ir.y) * scaleY;
    const sw = crop.w * scaleX;
    const sh = crop.h * scaleY;
    const canvas = canvasRef.current;
    canvas.width  = Math.round(sw);
    canvas.height = Math.round(sh);
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    onApply(canvas.toDataURL('image/jpeg', 0.92));
  };

  const ASPECTS = [
    { label: '□ Free',       value: null   },
    { label: '1:1 Square',   value: 1      },
    { label: '4:3 Landscape',value: 4/3    },
    { label: '3:4 Portrait', value: 3/4    },
    { label: '16:9 Wide',    value: 16/9   },
  ];

  const hasCrop = crop && crop.w > 10 && crop.h > 10;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 20, maxWidth: 600, width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, margin: 0 }}>✂️ Crop Photo</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: t.textTertiary, cursor: 'pointer', fontSize: 18, fontFamily: 'inherit' }}>✕</button>
        </div>

        {/* Aspect presets */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {ASPECTS.map(a => (
            <button key={String(a.value)} onClick={() => setAspect(a.value)}
              style={{ fontSize: 11, padding: '4px 12px', borderRadius: 8, border: `1px solid ${aspect === a.value ? t.accent : t.border}`, background: aspect === a.value ? t.accentBg : t.bgSurface, color: aspect === a.value ? t.accent : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontWeight: aspect === a.value ? 700 : 400 }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Crop area */}
        <div
          ref={overlayRef}
          style={{ position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden', cursor: 'crosshair', userSelect: 'none', lineHeight: 0, textAlign: 'center' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={() => setImgLoaded(true)}
            style={{ maxWidth: '100%', maxHeight: 380, display: 'inline-block', pointerEvents: 'none' }}
          />

          {hasCrop && crop && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {/* Four darkened panels around crop */}
              <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: crop.y, background: 'rgba(0,0,0,0.55)' }} />
              <div style={{ position: 'absolute', left: 0, top: crop.y + crop.h, right: 0, bottom: 0, background: 'rgba(0,0,0,0.55)' }} />
              <div style={{ position: 'absolute', left: 0, top: crop.y, width: crop.x, height: crop.h, background: 'rgba(0,0,0,0.55)' }} />
              <div style={{ position: 'absolute', left: crop.x + crop.w, top: crop.y, right: 0, height: crop.h, background: 'rgba(0,0,0,0.55)' }} />
              {/* Crop border */}
              <div style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h, border: '2px solid rgba(255,255,255,0.9)', boxSizing: 'border-box' }}>
                {/* Rule-of-thirds grid */}
                <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }} />
                <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.3)' }} />
                <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.3)' }} />
                <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, borderTop: '1px solid rgba(255,255,255,0.3)' }} />
              </div>
              {/* Corner handles */}
              {([[0,0],[1,0],[0,1],[1,1]] as [number,number][]).map(([cx,cy]) => (
                <div key={`${cx}${cy}`} style={{ position: 'absolute', left: crop.x + cx * crop.w - 5, top: crop.y + cy * crop.h - 5, width: 10, height: 10, background: '#fff', borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
              ))}
            </div>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <p style={{ fontSize: 11, color: t.textTertiary, margin: '10px 0 14px', textAlign: 'center' }}>
          {hasCrop && crop ? `${Math.round(crop.w)} × ${Math.round(crop.h)} display px` : 'Drag on image to select crop area'}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Cancel</button>
          <button onClick={applyCrop} disabled={!hasCrop}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: hasCrop ? t.accent : t.bgSurface, color: hasCrop ? '#fff' : t.textTertiary, cursor: hasCrop ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            ✓ Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Photo Uploader ───────────────────────────────────────────────────────────
function PhotoUploader({ value, onChange, t }: { value: string | null; onChange: (url: string | null, file: File | null) => void; t: any }) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Only JPG, PNG, or WebP images are supported.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert('Image must be under 3 MB.');
      return;
    }
    pendingFile.current = file;
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropApply = (dataUrl: string) => {
    setCropSrc(null);
    onChange(dataUrl, pendingFile.current);
  };

  return (
    <div>
      {/* Format badges */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {['JPG · PNG · WebP', 'Max 3 MB', 'Min 800×600 px'].map(s => (
          <span key={s} style={{ fontSize: 10, color: t.textTertiary, background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 8px' }}>{s}</span>
        ))}
      </div>

      {value ? (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: t.bgSurface, maxHeight: 220 }}>
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* Crop button */}
          <button
            onClick={() => setCropSrc(value)}
            style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, padding: '4px 10px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', backdropFilter: 'blur(6px)', fontFamily: 'inherit', fontWeight: 600 }}>
            ✂️ Crop
          </button>
          {/* Change button */}
          <button onClick={() => fileRef.current?.click()}
            style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 11, padding: '4px 10px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
          {/* Remove button */}
          <button onClick={() => onChange(null, null)}
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? t.accent : t.border}`, borderRadius: 12, height: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 6, color: t.textTertiary, background: dragOver ? t.accentBg : 'transparent', transition: 'all 0.15s' }}>
          <span style={{ fontSize: 28 }}>📸</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>Click or drag & drop</span>
          <span style={{ fontSize: 10 }}>JPG, PNG, WebP · max 3 MB</span>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      {cropSrc && (
        <CropModal src={cropSrc} t={t} onApply={handleCropApply} onCancel={() => setCropSrc(null)} />
      )}
    </div>
  );
}

// ─── Rich Text Editor ─────────────────────────────────────────────────────────
function RichEditor({ value, onChange, placeholder, minHeight = 120 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minHeight?: number;
}) {
  const { t } = useChefTheme();
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value || '';
      initialized.current = true;
    }
  }, []);

  const cmd = (command: string, val?: string) => {
    document.execCommand(command, false, val);
    ref.current?.focus();
    onChange(ref.current?.innerHTML || '');
  };

  const tools = [
    { label: 'B',  title: 'Bold',           fn: () => cmd('bold'),                  style: { fontWeight: 800 as const } },
    { label: 'I',  title: 'Italic',          fn: () => cmd('italic'),                style: { fontStyle: 'italic' as const } },
    { label: 'U',  title: 'Underline',       fn: () => cmd('underline'),             style: { textDecoration: 'underline' as const } },
    { label: 'H2', title: 'Heading',         fn: () => cmd('formatBlock', '<h3>'),   style: {} },
    { label: '•',  title: 'Bullet list',     fn: () => cmd('insertUnorderedList'),   style: {} },
    { label: '1.', title: 'Numbered list',   fn: () => cmd('insertOrderedList'),     style: {} },
    { label: '—',  title: 'Clear formatting',fn: () => cmd('removeFormat'),          style: {} },
  ];

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 11, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 3, padding: '7px 10px', background: t.bgElevated, borderBottom: `1px solid ${t.border}`, flexWrap: 'wrap' }}>
        {tools.map(tool => (
          <button key={tool.title} onMouseDown={e => { e.preventDefault(); tool.fn(); }} title={tool.title}
            style={{ ...tool.style, minWidth: 28, height: 28, padding: '0 6px', borderRadius: 6, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.textSecondary, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {tool.label}
          </button>
        ))}
      </div>
      <div
        ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || '')}
        data-ph={placeholder}
        style={{ minHeight, padding: '10px 13px', background: t.bgInput, color: t.textPrimary, fontSize: 13, lineHeight: 1.75, outline: 'none', fontFamily: 'inherit' }}
      />
      <style>{`
        [data-ph]:empty::before{content:attr(data-ph);color:${t.textTertiary};pointer-events:none;}
        [contenteditable] ul,[contenteditable] ol{padding-left:20px;margin:4px 0;}
        [contenteditable] h3{margin:6px 0 3px;font-size:14px;}
      `}</style>
    </div>
  );
}

// ─── Recipe Preview Card ──────────────────────────────────────────────────────
function RecipePreview({ title, cuisine, difficulty, cookTime, servings, desc, tips, calories, protein, carbs, fat, imageUrl, t, accent }: any) {
  const diffColor: Record<string, string> = { Easy: '#10B981', Moderate: '#F59E0B', Hard: '#EF4444', Expert: '#8B5CF6' };
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ height: 140, background: imageUrl ? `url(${imageUrl}) center/cover` : `linear-gradient(135deg,${accent}44,${accent}22)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {!imageUrl && <span style={{ fontSize: 48, opacity: 0.3 }}>🍳</span>}
        {difficulty && (
          <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: `${diffColor[difficulty] || '#888'}22`, color: diffColor[difficulty] || '#888', border: `1px solid ${diffColor[difficulty] || '#888'}44` }}>{difficulty}</div>
        )}
      </div>
      <div style={{ padding: '14px 16px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: t.textPrimary, margin: '0 0 6px' }}>{title || 'Recipe Title'}</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {cuisine && <span style={{ fontSize: 10, color: t.textTertiary }}>🍽 {cuisine}</span>}
          {cookTime && <span style={{ fontSize: 10, color: t.textTertiary }}>⏱ {cookTime}</span>}
          {servings > 0 && <span style={{ fontSize: 10, color: t.textTertiary }}>👥 {servings} servings</span>}
        </div>
        {desc && <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6, marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: desc }} />}
        {tips && <div style={{ background: `${accent}12`, border: `1px solid ${accent}33`, borderRadius: 9, padding: '8px 12px', marginBottom: 10 }}><span style={{ fontSize: 10, fontWeight: 700, color: accent }}>💡 Tips  </span><span style={{ fontSize: 12, color: t.textSecondary }}>{tips}</span></div>}
        {(calories || protein || carbs || fat) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {calories && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: t.bgSurface, color: t.textTertiary, border: `1px solid ${t.border}` }}>🔥 {calories} kcal</span>}
            {protein  && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: t.bgSurface, color: t.textTertiary, border: `1px solid ${t.border}` }}>💪 {protein}g protein</span>}
            {carbs    && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: t.bgSurface, color: t.textTertiary, border: `1px solid ${t.border}` }}>🌾 {carbs}g carbs</span>}
            {fat      && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: t.bgSurface, color: t.textTertiary, border: `1px solid ${t.border}` }}>🥑 {fat}g fat</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload / Edit Form ───────────────────────────────────────────────────────
function RecipeForm({ onClose, onSaved, initial }: {
  onClose: () => void;
  onSaved: (data: ListRecipe) => void;
  initial?: Partial<ListRecipe>;
}) {
  const { t } = useChefTheme();
  const [title, setTitle]           = useState(initial?.title || '');
  const [cuisine, setCuisine]       = useState(initial?.cuisine || '');
  const [difficulty, setDifficulty] = useState<string>(initial?.difficulty || 'Moderate');
  const [cookTime, setCookTime]     = useState(initial?.cook_time || '');
  const [servings, setServings]     = useState<number>(initial?.servings || 4);
  const [desc, setDesc]             = useState(initial?.description || '');
  const [tips, setTips]             = useState(initial?.tips || '');
  const [ytUrl, setYtUrl]           = useState(initial?.ytUrl || '');
  const [selectedReel, setSelectedReel] = useState('');
  const [reels, setReels]           = useState<{id:number;title:string;video_url?:string;platform?:string}[]>([]);
  const [imageUrl, setImageUrl]     = useState<string | null>(initial?.image_url || null);
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initial?.ingredients?.length ? initial.ingredients : [{ name: '', quantity: '', unit: 'g' }, { name: '', quantity: '', unit: 'g' }]
  );
  const [steps, setSteps]           = useState<string[]>(initial?.steps?.length ? initial.steps : ['', '']);
  const [calories, setCalories]     = useState(initial?.calories || '');
  const [protein, setProtein]       = useState(initial?.protein || '');
  const [carbs, setCarbs]           = useState(initial?.carbs || '');
  const [fat, setFat]               = useState(initial?.fat || '');
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState('');       // inline draft-saved banner
  const [published, setPublished]   = useState(false);
  const [done, setDone]             = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const accent = t.accent;

  // Load chef's reels for the dropdown
  useEffect(() => {
    const token = tok();
    if (!token) return;
    fetch(`${API}/chefs/me/reels?per_page=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.reels) setReels(d.reels); }).catch(() => {});
  }, []);

  const handleReelSelect = (reelId: string) => {
    setSelectedReel(reelId);
    if (!reelId) { setYtUrl(''); return; }
    const reel = reels.find(r => String(r.id) === reelId);
    if (reel?.video_url) setYtUrl(reel.video_url);
  };

  const fi: React.CSSProperties = {
    width: '100%', padding: '8px 11px', borderRadius: 10,
    border: `1px solid ${t.border}`, background: t.bgInput, color: t.textPrimary,
    fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { alert('Recipe name is required'); return; }
    setSaving(true);
    setPublished(publish);
    try {
      const token = tok();
      const res = await fetch(`${API}/chefs/me/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: initial?.id ?? null,
          title, cuisine, difficulty, cook_time: cookTime, servings,
          description: desc, tips, video_url: ytUrl,
          image_url: imageUrl,
          ingredients: ingredients.filter(i => i.name.trim()),
          steps: steps.filter(s => s.trim()),
          calories: calories || null, protein: protein || null,
          carbs: carbs || null, fat: fat || null,
          is_published: publish,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      const saved = await res.json();
      setSaving(false);

      const fullData: ListRecipe = {
        id: saved.id,
        title, cuisine, difficulty, cook_time: cookTime, servings,
        description: desc, tips, ytUrl, ingredients, steps, image_url: imageUrl,
        calories, protein, carbs, fat,
        views: initial?.views ?? 0,
        likes: initial?.likes ?? 0,
        published: publish,
        created: initial?.created ?? 'Just now',
      };

      if (publish) {
        setDone(true);
        // store fullData for when user clicks "Back to Recipes"
        (window as any).__savedRecipe = fullData;
      } else {
        setToast('✓ Draft saved');
        setTimeout(() => { setToast(''); onSaved(fullData); }, 1000);
      }
    } catch {
      setSaving(false);
      alert('Failed to save recipe. Please check your connection and try again.');
    }
  };

  // ── Published success screen ──
  if (done) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 24, background: t.bg }}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: t.textPrimary, fontFamily: 'Georgia, serif', margin: 0 }}>Recipe Published!</h2>
        <p style={{ fontSize: 13, color: t.textSecondary, textAlign: 'center', maxWidth: 320 }}>Viewers can now like, comment and share your recipe.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="ghost" t={t} onClick={() => { const d = (window as any).__savedRecipe; if (d) onSaved(d); }}>+ Add Another</Btn>
          <Btn t={t} onClick={() => { const d = (window as any).__savedRecipe; if (d) onSaved(d); }}>← Back to Recipes</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: t.bg }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 18px 80px' }}>

        {/* Draft saved toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: t.bgElevated, border: `1px solid ${t.success}55`, borderRadius: 12, padding: '10px 22px', fontSize: 13, fontWeight: 600, color: t.success, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
            {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>←</button>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: t.textPrimary, margin: 0 }}>{initial?.id ? 'Edit Recipe' : 'New Recipe'}</h1>
          </div>
          <button onClick={() => setShowPreview(v => !v)}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 9, border: `1px solid ${showPreview ? accent : t.border}`, background: showPreview ? t.accentBg : t.bgSurface, color: showPreview ? accent : t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            {showPreview ? '✕ Hide Preview' : '👁 Preview'}
          </button>
        </div>

        {/* Two-column layout when preview is open */}
        <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 280px' : '1fr', gap: 16, alignItems: 'start' }}>
          <div>

            {/* ── Basic Info ── */}
            <Card t={t} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 14px' }}>📋 Basic Info</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <SLabel t={t}>Recipe Name *</SLabel>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Authentic Chicken Biryani" style={fi} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <SLabel t={t}>Cuisine</SLabel>
                    <input value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Hyderabadi" style={fi} />
                  </div>
                  <div>
                    <SLabel t={t}>Difficulty</SLabel>
                    <CustomSelect
                      value={difficulty}
                      onChange={setDifficulty}
                      options={['Easy','Moderate','Hard','Expert'].map(d => ({ value: d, label: d }))}
                    />
                  </div>
                  <div>
                    <SLabel t={t}>Cook Time</SLabel>
                    <input value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="e.g. 45 min" style={fi} />
                  </div>
                  <div>
                    <SLabel t={t}>Servings</SLabel>
                    <input type="number" min={1} value={servings} onChange={e => setServings(Number(e.target.value))} placeholder="4" style={fi} />
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Photo Upload ── */}
            <Card t={t} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 10px' }}>📸 Recipe Photo</p>
              <PhotoUploader value={imageUrl} onChange={(url, file) => { setImageUrl(url); setImageFile(file); }} t={t} />
            </Card>

            {/* ── YouTube / Reel Video ── */}
            <Card t={t} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 4px' }}>
                🎬 Video Link <span style={{ fontSize: 10, color: t.textTertiary, fontWeight: 400 }}>(optional)</span>
              </p>
              <p style={{ fontSize: 11, color: t.textTertiary, margin: '0 0 12px' }}>Select from your existing reels or paste any video URL.</p>

              {reels.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <SLabel t={t}>Select from My Reels</SLabel>
                  <CustomSelect
                    value={selectedReel}
                    onChange={handleReelSelect}
                    placeholder="— None selected —"
                    options={[
                      { value: '', label: '— None selected —' },
                      ...reels.map(r => ({
                        value: String(r.id),
                        label: `${r.platform === 'youtube' ? '▶ YT' : r.platform === 'upload' ? '📁' : '🔗'} · ${r.title}`,
                      })),
                    ]}
                  />
                </div>
              )}

              <div>
                <SLabel t={t}>Or Paste Video URL</SLabel>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 13 }}>▶</span>
                  <input value={ytUrl} onChange={e => { setYtUrl(e.target.value); setSelectedReel(''); }} placeholder="https://youtube.com/watch?v=… or any video URL" style={{ ...fi, paddingLeft: 30 }} />
                </div>
              </div>

              {ytUrl && (
                <div style={{ marginTop: 8, padding: '7px 12px', background: t.bgSurface, borderRadius: 9, border: `1px solid ${t.borderAcc}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>✅</span>
                  <p style={{ fontSize: 12, color: t.textPrimary, margin: 0, fontWeight: 600 }}>Video linked</p>
                  <button onClick={() => { setYtUrl(''); setSelectedReel(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: t.textTertiary, cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              )}
            </Card>

            {/* ── Description (Rich Text) ── */}
            <Card t={t} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 4px' }}>📝 Description</p>
              <p style={{ fontSize: 11, color: t.textTertiary, margin: '0 0 10px' }}>Describe your recipe — techniques, story, variations. Use the toolbar to format.</p>
              <RichEditor value={desc} onChange={setDesc} placeholder="This biryani recipe has been passed down through three generations…" minHeight={130} />
            </Card>

            {/* ── Tips & Tricks ── */}
            <Card t={t} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 4px' }}>💡 Tips & Tricks <span style={{ fontSize: 10, color: t.textTertiary, fontWeight: 400 }}>(optional)</span></p>
              <p style={{ fontSize: 11, color: t.textTertiary, margin: '0 0 10px' }}>Share pro tips, substitutions, or common mistakes to avoid.</p>
              <textarea
                value={tips} onChange={e => setTips(e.target.value)}
                placeholder="e.g. Always soak the rice for 30 minutes before cooking for best results…"
                rows={3}
                style={{ ...fi, resize: 'vertical', lineHeight: 1.7 }}
              />
            </Card>

            {/* ── Ingredients ── */}
            <Card t={t} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 12px' }}>🥕 Ingredients</p>
              {ingredients.map((ing, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 110px 28px', gap: 6, marginBottom: 7, alignItems: 'center' }}>
                  <input value={ing.name} onChange={e => setIngredients(p => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Ingredient" style={fi} />
                  <input value={ing.quantity} onChange={e => setIngredients(p => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} placeholder="½, 1¼…" style={fi} />
                  <CustomSelect
                    value={ing.unit}
                    onChange={v => setIngredients(p => p.map((x, j) => j === i ? { ...x, unit: v } : x))}
                    options={['g','kg','ml','l','cup','tbsp','tsp','piece','pinch','small','medium','large','to taste','as needed','for frying'].map(u => ({ value: u, label: u }))}
                  />
                  <button onClick={() => ingredients.length > 1 && setIngredients(p => p.filter((_, j) => j !== i))}
                    style={{ width: 28, height: 34, borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.error, cursor: ingredients.length > 1 ? 'pointer' : 'not-allowed', fontSize: 12, opacity: ingredients.length > 1 ? 1 : 0.3, fontFamily: 'inherit' }}>✕</button>
                </div>
              ))}
              <button onClick={() => setIngredients(p => [...p, { name: '', quantity: '', unit: 'g' }])}
                style={{ padding: '5px 12px', borderRadius: 9, border: `1px dashed ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Ingredient</button>
            </Card>

            {/* ── Cooking Steps ── */}
            <Card t={t} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 12px' }}>👨‍🍳 Cooking Steps</p>
              {steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: t.accentBg, border: `1px solid ${t.borderAcc}`, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 6 }}>{i + 1}</div>
                  <textarea value={step} onChange={e => setSteps(p => p.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={`Step ${i + 1}…`} rows={2}
                    style={{ ...fi, flex: 1, resize: 'vertical' }} />
                  <button onClick={() => steps.length > 1 && setSteps(p => p.filter((_, j) => j !== i))}
                    style={{ width: 28, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.bgSurface, color: t.error, cursor: steps.length > 1 ? 'pointer' : 'not-allowed', fontSize: 12, marginTop: 5, opacity: steps.length > 1 ? 1 : 0.3, fontFamily: 'inherit' }}>✕</button>
                </div>
              ))}
              <button onClick={() => setSteps(p => [...p, ''])}
                style={{ padding: '5px 12px', borderRadius: 9, border: `1px dashed ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add Step</button>
            </Card>

            {/* ── Nutrition ── */}
            <Card t={t} style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, margin: '0 0 12px' }}>🥗 Nutrition <span style={{ fontSize: 10, color: t.textTertiary, fontWeight: 400 }}>(optional)</span></p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {([['🔥 Calories', calories, setCalories], ['💪 Protein (g)', protein, setProtein], ['🌾 Carbs (g)', carbs, setCarbs], ['🥑 Fat (g)', fat, setFat]] as [string, string, (v:string)=>void][]).map(([label, val, setter]) => (
                  <div key={label}>
                    <SLabel t={t}>{label}</SLabel>
                    <input type="number" min={0} value={val} onChange={e => setter(e.target.value)} placeholder="0" style={fi} />
                  </div>
                ))}
              </div>
            </Card>

            {/* ── Actions ── */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Btn variant="ghost" t={t} onClick={onClose}>Cancel</Btn>
              <Btn variant="ghost" t={t} onClick={() => handleSave(false)} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving && !published ? 'Saving…' : 'Save as Draft'}
              </Btn>
              <Btn t={t} onClick={() => handleSave(true)} style={{ minWidth: 140, opacity: saving ? 0.6 : 1 }}>
                {saving && published ? 'Publishing…' : '🍳 Publish Recipe'}
              </Btn>
            </div>

          </div>

          {/* ── Live Preview column ── */}
          {showPreview && (
            <div style={{ position: 'sticky', top: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Live Preview</p>
              <RecipePreview
                title={title} cuisine={cuisine} difficulty={difficulty}
                cookTime={cookTime} servings={servings} desc={desc} tips={tips}
                calories={calories} protein={protein} carbs={carbs} fat={fat}
                imageUrl={imageUrl} t={t} accent={accent}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Recipes List ─────────────────────────────────────────────────────────────
type ListRecipe = {
  id: number; title: string; cuisine: string; difficulty: string;
  cook_time: string; servings: number; description: string; tips: string;
  ytUrl: string; ingredients: RecipeIngredient[]; steps: string[];
  image_url: string | null; calories: string; protein: string; carbs: string; fat: string;
  views: number; likes: number; published: boolean; created: string;
};

function RecipesList({ list, onNew, onEdit, loading }: { list: ListRecipe[]; onNew: () => void; onEdit: (r: ListRecipe) => void; loading?: boolean }) {
  const { t } = useChefTheme();
  const router = useRouter();
  const isPro = false;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: t.bg, padding: '20px 18px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => router.push('/chef-dashboard')} style={{ background: 'none', border: 'none', color: t.textSecondary, cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>←</button>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: t.textPrimary, margin: 0 }}>My Recipes</h1>
              <p style={{ fontSize: 11, color: t.textTertiary, margin: 0 }}>{loading ? 'Loading…' : `${list.length} recipes · ${list.filter(r => r.published).length} live`}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ThemeToggle />
            <Btn t={t} onClick={onNew}>+ New Recipe</Btn>
          </div>
        </div>

        {!isPro && (
          <div style={{ background: t.bgCard, border: `1px solid ${t.borderAcc}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: t.textSecondary, flex: 1 }}>Free plan: {list.length}/3 recipes used</span>
            <Btn t={t} size="sm">✦ Upgrade for unlimited</Btn>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: t.textTertiary }}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>⏳</div>
            <p style={{ fontSize: 13, color: t.textSecondary, margin: 0 }}>Loading your recipes…</p>
          </div>
        )}

        {!loading && list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: t.textTertiary }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🍳</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: t.textSecondary, margin: '0 0 6px' }}>No recipes yet</p>
            <p style={{ fontSize: 12, margin: '0 0 18px' }}>Create your first recipe to share with the world.</p>
            <Btn t={t} onClick={onNew}>+ New Recipe</Btn>
          </div>
        )}

        {list.map(r => (
          <div key={r.id}
            style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 13, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 9, transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = t.borderAcc)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = t.border)}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: t.bgSurface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, opacity: 0.4, flexShrink: 0 }}>🍳</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
              <div style={{ display: 'flex', gap: 8, fontSize: 10, color: t.textTertiary, flexWrap: 'wrap' }}>
                <span>{r.cuisine}</span>
                <Pill t={t} accent small>{r.difficulty}</Pill>
                <span>👁 {fmtN(r.views)}</span>
                <span>♥ {r.likes}</span>
                <span>{r.created}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 9, padding: '2px 9px', borderRadius: 99, fontWeight: 600, background: r.published ? 'rgba(92,184,126,0.12)' : t.bgSurface, color: r.published ? t.success : t.textTertiary, border: `1px solid ${r.published ? 'rgba(92,184,126,0.25)' : t.border}` }}>
                {r.published ? '● Live' : '○ Draft'}
              </span>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => onEdit(r)} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                <button style={{ fontSize: 10, padding: '3px 9px', borderRadius: 7, border: `1px solid ${t.error}22`, background: 'transparent', color: t.error, cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recipes Page ─────────────────────────────────────────────────────────────
function apiToListRecipe(r: any): ListRecipe {
  return {
    id: r.id,
    title: r.title || '',
    cuisine: r.cuisine || '',
    difficulty: r.difficulty || 'Moderate',
    cook_time: r.cook_time || '',
    servings: r.servings || 4,
    description: r.description || '',
    tips: r.tips || '',
    ytUrl: r.video_url || '',
    ingredients: r.ingredients || [],
    steps: r.steps || [],
    image_url: r.image_url || null,
    calories: r.calories || '',
    protein: r.protein || '',
    carbs: r.carbs || '',
    fat: r.fat || '',
    views: 0,
    likes: r.like_count || 0,
    published: r.is_published ?? true,
    created: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Unknown',
  };
}

function RecipesPage() {
  const [mode, setMode]       = useState<'list' | 'new' | 'edit'>('list');
  const [editing, setEditing] = useState<ListRecipe | undefined>(undefined);
  const [list, setList]       = useState<ListRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Load real recipes from API on mount
  useEffect(() => {
    const token = tok();
    if (!token) { setLoading(false); return; }
    fetch(`${API}/chefs/me/recipes?per_page=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.recipes) setList(d.recipes.map(apiToListRecipe)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (r: ListRecipe) => { setEditing(r); setMode('edit'); };

  const handleSaved = (data: ListRecipe) => {
    setList(prev => {
      const exists = prev.some(r => r.id === data.id);
      return exists ? prev.map(r => r.id === data.id ? data : r) : [data, ...prev];
    });
    setMode('list');
    setEditing(undefined);
  };

  if (mode === 'new' || mode === 'edit') {
    return (
      <RecipeForm
        initial={mode === 'edit' ? editing : undefined}
        onClose={() => { setMode('list'); setEditing(undefined); }}
        onSaved={handleSaved}
      />
    );
  }
  return <RecipesList list={list} onNew={() => setMode('new')} onEdit={handleEdit} loading={loading} />;
}

export default function RecipesWrapper() {
  return <RecipesPage />;
}
