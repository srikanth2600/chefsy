'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useChefTheme } from '@/components/chef/ChefThemeContext';
import { Avatar } from '@/components/chef/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

interface OrgData {
  org_name: string;
  org_type: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  official_email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  member_count: number;
  group_count: number;
  is_verified: boolean;
  is_public: boolean;
  plan: string;
  active_modules: string[];
}

const NAV_SHORTCUTS = [
  { href: '/org-dashboard/members',      icon: '👥', label: 'Members',      desc: 'Invite and manage your members' },
  { href: '/org-dashboard/groups',       icon: '◎',  label: 'Groups',       desc: 'Organise members into groups' },
  { href: '/org-dashboard/meal-planner', icon: '🥗', label: 'Meal Planner', desc: 'Create template meal plans' },
  { href: '/org-dashboard/content',      icon: '🎬', label: 'Content',      desc: 'Publish videos & articles' },
  { href: '/org-dashboard/settings',     icon: '⚙',  label: 'Settings',     desc: 'Profile, address & branding' },
];

export default function OrgDashboardPage() {
  const { t } = useChefTheme();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/org/me`, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setOrg(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, color: t.textSecondary, fontSize: 14 }}>Loading…</div>;
  if (!org)    return <div style={{ padding: 40, color: t.error || '#ef4444', fontSize: 14 }}>Failed to load organisation data.</div>;

  const isPro = org.plan === 'enterprise' || org.plan === 'growth';

  const stats = [
    { label: 'Total Members', value: org.member_count,                         icon: '👥', href: '/org-dashboard/members' },
    { label: 'Groups',        value: org.group_count,                          icon: '◎',  href: '/org-dashboard/groups' },
    { label: 'Modules',       value: (org.active_modules || []).length,        icon: '⚡', href: '/org-dashboard/settings' },
  ];

  return (
    <div style={{ maxWidth: 900, fontFamily: 'inherit', color: t.textPrimary }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar
            name={org.org_name}
            color={t.accent}
            imageUrl={org.logo_url ? `${API}${org.logo_url}` : undefined}
            size={56}
            radius={12}
          />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: t.textPrimary, margin: 0 }}>{org.org_name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: t.textSecondary, textTransform: 'capitalize' }}>{org.org_type}</span>
              {org.is_verified && (
                <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.15)', color: '#22c55e', borderRadius: 99, padding: '1px 8px', fontWeight: 600 }}>✓ Verified</span>
              )}
              <span style={{ fontSize: 11, background: t.accentBg, color: t.accent, border: `1px solid ${t.borderAcc}`, borderRadius: 99, padding: '1px 8px', fontWeight: 600 }}>
                {org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : 'Free'}
              </span>
            </div>
          </div>
        </div>
        {org.is_public && org.slug && (
          <Link href={`/org/${org.slug}`} target="_blank"
            style={{ fontSize: 12, color: t.accent, textDecoration: 'none', border: `1px solid ${t.borderAcc}`, borderRadius: 8, padding: '6px 14px', background: t.accentBg }}>
            👁 View Public Page →
          </Link>
        )}
      </div>

      {/* Tagline */}
      {org.tagline && (
        <p style={{ fontSize: 14, color: t.textSecondary, marginBottom: 24, marginTop: -16, lineHeight: 1.6 }}>{org.tagline}</p>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {stats.map(s => (
          <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: t.accent }}>{s.value}</div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: 11, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
        {NAV_SHORTCUTS.map(s => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: t.textTertiary, lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Org Details */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '20px 22px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 14 }}>📋 Organisation Details</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Slug / URL',      value: org.slug           || '—' },
            { label: 'Official Email',  value: org.official_email || '—' },
            { label: 'Phone',           value: org.phone          || '—' },
            { label: 'Location',        value: [org.city, org.state].filter(Boolean).join(', ') || '—' },
            { label: 'Public Listing',  value: org.is_public ? 'Yes — visible publicly' : 'No — private' },
          ].map(row => (
            <div key={row.label}>
              <div style={{ fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{row.label}</div>
              <div style={{ fontSize: 13, color: t.textSecondary }}>{row.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/org-dashboard/settings" style={{ fontSize: 13, color: t.accent, textDecoration: 'none' }}>
            Edit organisation profile →
          </Link>
        </div>
      </div>
    </div>
  );
}
