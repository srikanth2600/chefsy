'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChefTheme } from '@/components/chef/ChefThemeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const MAX_FILE_MB = 100;

/* ── helpers ── */
function getYouTubeId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    return u.searchParams.get('v') || '';
  } catch { return ''; }
}

function buildEmbedUrl(url: string): { type: 'iframe' | 'video' | 'link' | null; src: string; platform: string } {
  if (!url) return { type: null, src: '', platform: '' };
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    const id = getYouTubeId(url);
    return id
      ? { type: 'iframe', src: `https://www.youtube.com/embed/${id}?rel=0`, platform: 'youtube' }
      : { type: 'link', src: url, platform: 'youtube' };
  }
  if (lower.includes('vimeo.com')) {
    const id = url.split('/').pop() || '';
    return { type: 'iframe', src: `https://player.vimeo.com/video/${id}`, platform: 'vimeo' };
  }
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
    return { type: 'link', src: url, platform: 'facebook' };
  }
  if (lower.includes('instagram.com')) {
    return { type: 'link', src: url, platform: 'instagram' };
  }
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
    return { type: 'video', src: url, platform: 'direct' };
  }
  return { type: 'link', src: url, platform: 'other' };
}

/* ── field wrapper ── */
function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  const { t } = useChefTheme();
  return (
    <div style={{ marginBottom: 22 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSecondary, marginBottom: 7, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ margin: '5px 0 0', fontSize: 11, color: t.textTertiary }}>{hint}</p>}
    </div>
  );
}

/* ── tag input ── */
function TagInput({ tags, onChange, t }: { tags: string[]; onChange: (tags: string[]) => void; t: any }) {
  const [input, setInput] = useState('');

  const add = (raw: string) => {
    const val = raw.trim().replace(/^#+/, '');
    if (!val) return;
    const tag = `#${val}`;
    if (!tags.includes(tag)) onChange([...tags, tag]);
    setInput('');
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const remove = (tag: string) => onChange(tags.filter(t => t !== tag));

  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        border: `1.5px solid ${t.border}`, borderRadius: 10, padding: '8px 12px',
        background: t.bg, minHeight: 44, cursor: 'text',
      }}
      onClick={() => document.getElementById('tag-inp')?.focus()}
    >
      {tags.map(tag => (
        <span key={tag} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: t.accentBg, color: t.accent, borderRadius: 99,
          padding: '3px 10px', fontSize: 12, fontWeight: 600,
          border: `1px solid ${t.borderAcc}`,
        }}>
          {tag}
          <button onClick={() => remove(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.accent, padding: 0, fontSize: 12, lineHeight: 1, marginTop: -1 }}>×</button>
        </span>
      ))}
      <input
        id="tag-inp"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => input.trim() && add(input)}
        placeholder={tags.length === 0 ? 'Type a tag and press Enter  e.g. paneer, indianfood' : ''}
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          fontSize: 13, color: t.textPrimary, flex: 1, minWidth: 140, padding: 0,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

/* ── main component ── */
export default function CreateReelPage() {
  const { t } = useChefTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit') ? Number(searchParams.get('edit')) : null;

  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags]       = useState<string[]>([]);
  const [videoUrl, setVideoUrl]       = useState('');
  const [urlDebounced, setUrlDebounced] = useState('');
  const [videoMode, setVideoMode]     = useState<'url' | 'upload'>('url');
  const [uploadFile, setUploadFile]   = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  /* debounce URL for embed preview */
  useEffect(() => {
    const t = setTimeout(() => setUrlDebounced(videoUrl), 600);
    return () => clearTimeout(t);
  }, [videoUrl]);

  /* load existing reel data when editing */
  useEffect(() => {
    if (!editId) return;
    const token = tok();
    if (!token) return;
    fetch(`${API}/chefs/me/reels`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const reel = d?.reels?.find((r: any) => r.id === editId);
        if (!reel) return;
        setTitle(reel.title || '');
        setDescription(reel.description || '');
        setHashtags(reel.hashtags || []);
        if (reel.video_url) { setVideoUrl(reel.video_url); setVideoMode('url'); }
        else if (reel.video_file_path) { setVideoMode('upload'); }
      }).catch(() => {});
  }, [editId]);

  const embed = buildEmbedUrl(urlDebounced);

  /* handle file pick/drop */
  const handleFile = (file: File) => {
    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
      setError('Only MP4, MOV, and WebM files are allowed'); return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Video must be under ${MAX_FILE_MB} MB`); return;
    }
    setError('');
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, []);

  /* char count */
  const descLen = description.length;
  const descOver = descLen > 200;

  /* submit */
  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('Recipe title is required'); return; }
    if (videoMode === 'url' && !videoUrl.trim()) { setError('Please paste a video URL or switch to file upload'); return; }
    if (videoMode === 'upload' && !uploadFile && !editId) { setError('Please choose a video file or switch to URL mode'); return; }
    if (descOver) { setError('Description must be 200 characters or less'); return; }
    setSaving(true);

    try {
      const token = tok();
      if (!token) { router.push('/'); return; }

      if (editId) {
        // Update existing reel
        const payload: Record<string, unknown> = { title: title.trim(), hashtags };
        if (description) payload.description = description;
        if (videoMode === 'url' && videoUrl) payload.video_url = videoUrl;
        const r = await fetch(`${API}/chefs/me/reels/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      } else if (videoMode === 'url') {
        const payload = { title: title.trim(), description: description || undefined, hashtags, video_url: videoUrl };
        const r = await fetch(`${API}/chefs/me/reels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      } else {
        // file upload
        const fd = new FormData();
        fd.append('file', uploadFile!);
        fd.append('title', title.trim());
        if (description) fd.append('description', description);
        fd.append('hashtags', JSON.stringify(hashtags));
        const r = await fetch(`${API}/chefs/me/reels/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!r.ok) { const d = await r.json(); throw new Error(d.detail || `HTTP ${r.status}`); }
      }

      setSuccess(true);
      setTimeout(() => router.push('/chef-dashboard/reels'), 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  /* ── render ── */
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: 14, color: t.textPrimary,
    background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 10,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ padding: '28px 32px', background: t.bg, minHeight: '100vh' }}>

      {/* Back + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => router.push('/chef-dashboard/reels')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: t.textTertiary, padding: 0 }}
        >←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.textPrimary, letterSpacing: '-0.02em' }}>
            {editId ? 'Edit Reel' : 'Create Reel'}
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: t.textTertiary }}>
            Share a cooking video with your followers
          </p>
        </div>
      </div>

      {success && (
        <div style={{ background: '#10B98122', border: '1px solid #10B98144', color: '#10B981', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, fontWeight: 600 }}>
          ✓ Reel {editId ? 'updated' : 'published'} successfully! Redirecting…
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, maxWidth: 960 }}>

        {/* ── Left column: form ── */}
        <div>
          {/* Recipe Title */}
          <Field label="Recipe Title" required>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Example: Authentic Paneer Butter Masala"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = t.accent)}
              onBlur={e => (e.target.style.borderColor = t.border)}
            />
          </Field>

          {/* Short Description */}
          <Field label="Short Description" hint={`${descLen}/200 characters`}>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A short explanation of the reel content…"
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                borderColor: descOver ? '#EF4444' : t.border,
              }}
              onFocus={e => (e.target.style.borderColor = descOver ? '#EF4444' : t.accent)}
              onBlur={e => (e.target.style.borderColor = descOver ? '#EF4444' : t.border)}
            />
            {descOver && <p style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>Description is too long</p>}
          </Field>

          {/* Hashtags */}
          <Field label="Hashtags / Keywords" hint="Press Enter or comma to add a tag">
            <TagInput tags={hashtags} onChange={setHashtags} t={t} />
            {hashtags.length === 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {['#indianfood', '#quickrecipe', '#healthymeal', '#cooking'].map(s => (
                  <button
                    key={s}
                    onClick={() => !hashtags.includes(s) && setHashtags([...hashtags, s])}
                    style={{
                      fontSize: 11, padding: '3px 9px', borderRadius: 99, cursor: 'pointer',
                      background: 'transparent', border: `1px solid ${t.border}`, color: t.textTertiary,
                      fontFamily: 'inherit',
                    }}
                  >{s}</button>
                ))}
              </div>
            )}
          </Field>

          {/* Video input mode toggle */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Video Source <span style={{ color: '#EF4444' }}>*</span>
            </p>
            <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${t.border}`, width: 'fit-content' }}>
              {(['url', 'upload'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setVideoMode(mode)}
                  style={{
                    padding: '9px 22px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: videoMode === mode ? t.accent : 'transparent',
                    color: videoMode === mode ? '#fff' : t.textSecondary,
                    transition: 'all 0.15s',
                  }}
                >
                  {mode === 'url' ? '🔗 Video URL' : '📁 Upload File'}
                </button>
              ))}
            </div>
          </div>

          {/* URL mode */}
          {videoMode === 'url' && (
            <Field label="Video URL" hint="YouTube, Facebook, Instagram, Vimeo, or direct MP4 link">
              <input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="Paste video URL (YouTube, Facebook, Instagram etc.)"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = t.accent)}
                onBlur={e => (e.target.style.borderColor = t.border)}
              />
              {videoUrl && embed.platform && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: t.textTertiary }}>Detected:</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: t.accentBg, color: t.accent, border: `1px solid ${t.borderAcc}`,
                  }}>{embed.platform}</span>
                </div>
              )}
            </Field>
          )}

          {/* Upload mode */}
          {videoMode === 'upload' && (
            <Field label="Upload Video" hint="MP4, MOV, WebM · max 100 MB">
              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? t.accent : t.border}`,
                  borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: dragOver ? t.accentBg : t.bgElevated,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {uploadFile ? (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.textPrimary }}>{uploadFile.name}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: t.textTertiary }}>
                      {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <button
                      onClick={e => { e.stopPropagation(); setUploadFile(null); setUploadPreview(''); }}
                      style={{ marginTop: 8, fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
                    >Remove</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: t.textSecondary }}>
                      Drag & drop your video here
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: t.textTertiary }}>
                      or click to browse · MP4 / MOV / WebM · max {MAX_FILE_MB} MB
                    </p>
                  </div>
                )}
              </div>
            </Field>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: '#EF444411', border: '1px solid #EF444433', color: '#EF4444', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={submit}
            disabled={saving || success}
            style={{
              width: '100%', padding: '13px', fontSize: 15, fontWeight: 700,
              background: saving || success ? t.accent + '88' : t.accent,
              color: '#fff', border: 'none', borderRadius: 12, cursor: saving ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em', boxShadow: saving ? 'none' : `0 4px 16px ${t.accent}44`,
              transition: 'all 0.15s',
            }}
          >
            {saving ? '⏳ Publishing…' : success ? '✓ Published!' : editId ? '✓ Update Reel' : '🚀 Publish Reel'}
          </button>
        </div>

        {/* ── Right column: preview ── */}
        <div>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Video Preview
          </p>
          <div style={{
            borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${t.border}`,
            background: t.bgElevated, minHeight: 200,
          }}>
            {/* Preview area */}
            {videoMode === 'url' && urlDebounced && embed.type === 'iframe' && (
              <iframe
                src={embed.src}
                style={{ width: '100%', height: 220, border: 'none', display: 'block' }}
                allow="autoplay; fullscreen"
                title="Preview"
              />
            )}
            {videoMode === 'url' && urlDebounced && embed.type === 'video' && (
              <video controls style={{ width: '100%', maxHeight: 220, display: 'block' }} src={embed.src} />
            )}
            {videoMode === 'url' && urlDebounced && embed.type === 'link' && (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>
                  {embed.platform === 'facebook' ? '📘' : embed.platform === 'instagram' ? '📷' : '🔗'}
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: t.textSecondary, fontWeight: 600 }}>
                  {embed.platform === 'facebook' ? 'Facebook Video' : embed.platform === 'instagram' ? 'Instagram Reel' : 'External Video'}
                </p>
                <a href={urlDebounced} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: t.accent, wordBreak: 'break-all' }}>
                  ↗ Open link
                </a>
                <p style={{ margin: '12px 0 0', fontSize: 11, color: t.textTertiary }}>
                  Live embed not available for {embed.platform}
                </p>
              </div>
            )}
            {videoMode === 'upload' && uploadPreview && (
              <video controls style={{ width: '100%', maxHeight: 220, display: 'block' }} src={uploadPreview} />
            )}
            {((videoMode === 'url' && !urlDebounced) || (videoMode === 'upload' && !uploadPreview)) && (
              <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ fontSize: 36 }}>🎬</div>
                <p style={{ margin: 0, fontSize: 13, color: t.textTertiary }}>
                  {videoMode === 'url' ? 'Paste a URL to see preview' : 'Upload a video to see preview'}
                </p>
              </div>
            )}

            {/* Card preview */}
            {(title || hashtags.length > 0 || description) && (
              <div style={{ padding: '14px 16px', borderTop: `1px solid ${t.border}` }}>
                {title && (
                  <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 700, color: t.textPrimary }}>{title}</p>
                )}
                {description && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: t.textSecondary, lineHeight: 1.5 }}>{description}</p>
                )}
                {hashtags.length > 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: t.accent }}>
                    {hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Platform guide */}
          <div style={{ marginTop: 20, padding: 16, background: t.bgElevated, borderRadius: 12, border: `1px solid ${t.border}` }}>
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Supported Platforms
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: '▶', name: 'YouTube', tip: 'Full embed preview', color: '#FF0000' },
                { icon: '▣', name: 'Vimeo', tip: 'Full embed preview', color: '#1AB7EA' },
                { icon: '📘', name: 'Facebook Video', tip: 'Link opens in new tab', color: '#1877F2' },
                { icon: '📷', name: 'Instagram Reel', tip: 'Link opens in new tab', color: '#C13584' },
                { icon: '📁', name: 'Direct MP4 / Upload', tip: 'HTML5 video player', color: '#10B981' },
              ].map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, color: p.color }}>{p.icon}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: t.textSecondary }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: t.textTertiary }}>{p.tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
