'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';

interface OrgPublic {
  id: number;
  org_name: string;
  org_type: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  banner_url: string | null;
  city: string | null;
  state: string | null;
  member_count: number;
  accent_color: string;
}

const TYPE_ICON: Record<string, string> = {
  gym: '🏋️', nutrition: '🥗', corporate: '🏢', others: '🏛️',
};

export default function PublicOrgPage() {
  const params = useParams<{ slug: string }>();
  const slug   = params?.slug || '';

  const [org,     setOrg]     = useState<OrgPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API}/org/${slug}`)
      .then(r => {
        if (r.status === 404 || r.status === 403) { setNotFound(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => { if (d) setOrg(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', fontFamily: 'system-ui, sans-serif' }}>
        Loading…
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Organisation not found</h1>
        <p style={{ fontSize: 14, color: '#64748b' }}>This organisation profile is private or does not exist.</p>
        <a href="/" style={{ marginTop: 20, color: '#3b82f6', fontSize: 14 }}>← Back to home</a>
      </div>
    );
  }

  const accent = org.accent_color || '#3b82f6';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
      {/* Banner */}
      <div style={{ height: 200, background: org.banner_url ? `url(${API}${org.banner_url}) center/cover no-repeat` : `linear-gradient(135deg, ${accent}22, ${accent}44)`, position: 'relative' }}>
        {!org.banner_url && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, opacity: 0.3 }}>
            {TYPE_ICON[org.org_type?.toLowerCase()] || '🏢'}
          </div>
        )}
      </div>

      {/* Profile section */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginTop: -36, marginBottom: 20 }}>
          {/* Logo */}
          <div style={{ flexShrink: 0 }}>
            {org.logo_url ? (
              <img src={`${API}${org.logo_url}`} alt="logo"
                style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: 16, background: '#fff', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                {TYPE_ICON[org.org_type?.toLowerCase()] || '🏢'}
              </div>
            )}
          </div>
          <div style={{ paddingBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>{org.org_name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{org.org_type}</span>
              {(org.city || org.state) && (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  · 📍 {[org.city, org.state].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {org.tagline && (
          <p style={{ fontSize: 15, color: '#475569', margin: '0 0 24px', lineHeight: 1.6 }}>{org.tagline}</p>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{org.member_count}</div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Members</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: accent, textTransform: 'capitalize' }}>{org.org_type}</div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</div>
          </div>
        </div>

        {/* Contact / CTA */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '24px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px', color: '#0f172a' }}>Get in touch</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px', lineHeight: 1.6 }}>
            Interested in joining {org.org_name}? Contact the organisation directly or visit their premises.
          </p>
          <a href="/"
            style={{ display: 'inline-block', background: accent, color: '#fff', borderRadius: 9, padding: '10px 24px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            ← Explore Chefsy
          </a>
        </div>
      </div>
    </div>
  );
}
