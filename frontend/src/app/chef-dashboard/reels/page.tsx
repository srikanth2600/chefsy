'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChefTheme } from '@/components/chef/ChefThemeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

interface Reel {
  id: number;
  chef_id: number;
  title: string;
  description?: string;
  hashtags: string[];
  video_url?: string;
  video_file_path?: string;
  platform?: string;
  thumbnail?: string;
  status: string;
  view_count: number;
  created_at: string;
}

function getYouTubeId(url: string): string {
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.split('/').pop() || '';
  } catch { return ''; }
}

function PlatformBadge({ platform }: { platform?: string }) {
  const map: Record<string, { label: string; color: string }> = {
    youtube:   { label: 'YouTube',   color: '#FF0000' },
    facebook:  { label: 'Facebook',  color: '#1877F2' },
    instagram: { label: 'Instagram', color: '#C13584' },
    vimeo:     { label: 'Vimeo',     color: '#1AB7EA' },
    direct:    { label: 'MP4',       color: '#6B7280' },
    upload:    { label: 'Uploaded',  color: '#10B981' },
    other:     { label: 'Link',      color: '#9CA3AF' },
  };
  const info = map[platform || ''] || { label: platform || 'Link', color: '#9CA3AF' };
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
      padding: '2px 7px', borderRadius: 99,
      background: info.color + '22', color: info.color,
      border: `1px solid ${info.color}44`,
    }}>{info.label}</span>
  );
}

function VideoThumb({ reel }: { reel: Reel }) {
  const ytId = reel.platform === 'youtube' && reel.video_url ? getYouTubeId(reel.video_url) : '';
  if (ytId) {
    return <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (reel.thumbnail) {
    return <img src={reel.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }
  if (reel.video_file_path) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
        🎬
      </div>
    );
  }
  return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>▶</div>;
}

export default function ReelsPage() {
  const { t } = useChefTheme();
  const router = useRouter();
  const [reels, setReels]       = useState<Reel[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [preview, setPreview]   = useState<Reel | null>(null);

  const load = useCallback(async () => {
    const token = tok();
    if (!token) { router.push('/'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/chefs/me/reels?per_page=50`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { if (r.status === 401) router.push('/'); return; }
      const d = await r.json();
      setReels(d.reels || []);
      setTotal(d.total || 0);
    } catch {}
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const deleteReel = async (id: number) => {
    if (!confirm('Delete this reel?')) return;
    setDeleting(id);
    try {
      await fetch(`${API}/chefs/me/reels/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok()}` } });
      setReels(prev => prev.filter(r => r.id !== id));
      setTotal(prev => prev - 1);
    } catch {}
    finally { setDeleting(null); }
  };

  return (
    <div style={{ padding: '28px 32px', background: t.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.textPrimary, letterSpacing: '-0.02em' }}>
            🎬 My Reels
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: t.textTertiary }}>
            Share your cooking videos · {total} reel{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => router.push('/chef-dashboard/reels/create')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: t.accent, color: '#fff',
            border: 'none', borderRadius: 10, padding: '10px 18px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 2px 10px ${t.accent}55`,
          }}
        >
          <span style={{ fontSize: 15 }}>+</span>
          Create Reel
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ borderRadius: 14, overflow: 'hidden', background: t.bgElevated, border: `1px solid ${t.border}` }}>
              <div style={{ height: 130, background: t.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ padding: 12 }}>
                <div style={{ height: 12, background: t.border, borderRadius: 6, marginBottom: 8 }} />
                <div style={{ height: 10, background: t.border, borderRadius: 6, width: '60%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : reels.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: t.bgElevated, borderRadius: 16, border: `1px solid ${t.border}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: t.textPrimary }}>No reels yet</h3>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: t.textTertiary, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
            Share your cooking videos to attract customers. Embed a YouTube link or upload your own video.
          </p>
          <button
            onClick={() => router.push('/chef-dashboard/reels/create')}
            style={{
              background: t.accent, color: '#fff', border: 'none', borderRadius: 10,
              padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            + Create Your First Reel
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {reels.map(reel => (
            <div
              key={reel.id}
              style={{
                borderRadius: 14, overflow: 'hidden',
                background: t.bgElevated, border: `1px solid ${t.border}`,
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.12)`)}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              {/* Thumbnail */}
              <div
                style={{ height: 130, background: t.border, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                onClick={() => setPreview(reel)}
              >
                <VideoThumb reel={reel} />
                {/* Play overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <span style={{ fontSize: 32, color: '#fff' }}>▶</span>
                </div>
                {/* Status badge */}
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                    background: reel.status === 'active' ? '#10B98122' : '#EF444422',
                    color: reel.status === 'active' ? '#10B981' : '#EF4444',
                    border: `1px solid ${reel.status === 'active' ? '#10B98144' : '#EF444444'}`,
                  }}>{reel.status}</span>
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <PlatformBadge platform={reel.platform} />
                  <span style={{ fontSize: 10, color: t.textTertiary, marginLeft: 'auto' }}>
                    👁 {reel.view_count}
                  </span>
                </div>
                <p style={{
                  margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: t.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{reel.title}</p>
                {reel.hashtags?.length > 0 && (
                  <p style={{
                    margin: '0 0 8px', fontSize: 10, color: t.accent,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {reel.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: 10, color: t.textTertiary }}>
                  {new Date(reel.created_at).toLocaleDateString()}
                </p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button
                    onClick={() => router.push(`/chef-dashboard/reels/create?edit=${reel.id}`)}
                    style={{
                      flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 0', border: `1px solid ${t.border}`,
                      borderRadius: 7, background: 'transparent', color: t.textSecondary, cursor: 'pointer',
                    }}
                  >Edit</button>
                  <button
                    onClick={() => deleteReel(reel.id)}
                    disabled={deleting === reel.id}
                    style={{
                      flex: 1, fontSize: 11, fontWeight: 600, padding: '6px 0',
                      border: '1px solid #EF444433', borderRadius: 7,
                      background: '#EF444411', color: '#EF4444', cursor: 'pointer',
                    }}
                  >{deleting === reel.id ? '…' : 'Delete'}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={e => e.target === e.currentTarget && setPreview(null)}
        >
          <div style={{
            background: t.bgElevated, borderRadius: 18, overflow: 'hidden',
            width: '100%', maxWidth: 580, boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.textPrimary }}>{preview.title}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <PlatformBadge platform={preview.platform} />
                </div>
              </div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: t.textTertiary, padding: 4 }}>✕</button>
            </div>
            {/* Video player */}
            <div style={{ background: '#000', position: 'relative' }}>
              {preview.platform === 'youtube' && preview.video_url && (() => {
                const ytId = getYouTubeId(preview.video_url);
                return ytId ? (
                  <iframe
                    width="100%" height="315"
                    src={`https://www.youtube.com/embed/${ytId}?rel=0&autoplay=1`}
                    title="YouTube"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : null;
              })()}
              {preview.platform === 'vimeo' && preview.video_url && (() => {
                const vimeoId = preview.video_url.split('/').pop() || '';
                return (
                  <iframe
                    width="100%" height="315"
                    src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1`}
                    title="Vimeo"
                    frameBorder="0"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                );
              })()}
              {(preview.platform === 'facebook' || preview.platform === 'instagram') && preview.video_url && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <p style={{ color: '#fff', fontSize: 13, marginBottom: 12 }}>Open video in new tab:</p>
                  <a href={preview.video_url} target="_blank" rel="noreferrer" style={{ color: t.accent, fontSize: 13 }}>
                    ↗ {preview.video_url}
                  </a>
                </div>
              )}
              {preview.platform === 'upload' && preview.video_file_path && (
                <video
                  controls
                  style={{ width: '100%', maxHeight: 315, display: 'block' }}
                  src={`${API}${preview.video_file_path}`}
                />
              )}
              {(preview.platform === 'direct' || preview.platform === 'other') && preview.video_url && (
                <video
                  controls
                  style={{ width: '100%', maxHeight: 315, display: 'block' }}
                  src={preview.video_url}
                />
              )}
            </div>
            {/* Details */}
            <div style={{ padding: '14px 18px' }}>
              {preview.description && (
                <p style={{ margin: '0 0 10px', fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{preview.description}</p>
              )}
              {preview.hashtags?.length > 0 && (
                <p style={{ margin: 0, fontSize: 12, color: t.accent }}>
                  {preview.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
