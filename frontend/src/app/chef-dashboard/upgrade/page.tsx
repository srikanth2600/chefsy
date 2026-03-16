'use client';

/**
 * /chef-dashboard/upgrade — Chef Pricing Page
 * ══════════════════════════════════════════════
 * Three tiers: Free · Pro · Enterprise
 * Rendered inside ChefShell (sidebar already provided by layout.tsx)
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChefTheme } from '@/components/chef/ChefThemeContext';

/* ─── Admin-configurable pricing ─────────────────────────────────────── */
const chefPricingConfig = {
  pro_monthly: 299,
  yearly_discount: 10,
  free_recipes: 5,
  pro_recipes: 20,
  free_reels: 5,
  pro_reels: 20,
};

function yearlyTotal(monthly: number, pct: number) {
  return Math.round(monthly * 12 * (1 - pct / 100));
}

/* ─── Icons ──────────────────────────────────────────────────────────── */
const Check = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="10" cy="10" r="10" fill={`${color}28`} />
    <path d="M6 10.5l3 3 5-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cross = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="10" cy="10" r="10" fill="rgba(150,130,100,0.1)" />
    <path d="M7 7l6 6M13 7l-6 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/* ─── Feature row ─────────────────────────────────────────────────────── */
function FRow({ text, on = true, accent, tertiary }: { text: string; on?: boolean; accent: string; tertiary: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', opacity: on ? 1 : 0.45 }}>
      {on ? <Check color={accent} /> : <Cross color={tertiary} />}
      <span style={{ fontSize: 12.5, color: on ? undefined : tertiary, textDecoration: on ? 'none' : 'line-through' }}>
        {text}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════
   PAGE
══════════════════════════════════════════ */
export default function ChefUpgradePage() {
  const router = useRouter();
  const { t } = useChefTheme();
  const [yearly, setYearly] = useState(false);

  const mp = chefPricingConfig.pro_monthly;
  const disc = chefPricingConfig.yearly_discount;
  const annualTotal = yearlyTotal(mp, disc);
  const monthlyEquiv = Math.round(annualTotal / 12);
  const showPrice = yearly ? monthlyEquiv : mp;

  return (
    <div style={{
      padding: '28px 24px 56px',
      color: t.textPrimary,
      fontFamily: 'var(--font-dm-sans), DM Sans, system-ui, sans-serif',
      minHeight: '100%',
    }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: t.accentBg, border: `1px solid ${t.borderAcc}`,
          borderRadius: 999, padding: '3px 12px', marginBottom: 12,
          fontSize: 11, fontWeight: 700, color: t.accent,
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          ✦ Chef Plans
        </div>
        <h1 style={{ fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 8px', color: t.textPrimary }}>
          Grow Your Chef Career
        </h1>
        <p style={{ fontSize: 13.5, color: t.textSecondary, maxWidth: 480, margin: '0 auto 22px', lineHeight: 1.6 }}>
          Build your brand, reach more food lovers, and monetize your culinary expertise.
        </p>

        {/* Billing toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: yearly ? 400 : 700, color: yearly ? t.textTertiary : t.textPrimary, transition: 'color 0.2s' }}>
            Monthly
          </span>
          <button
            onClick={() => setYearly(v => !v)}
            style={{
              position: 'relative', width: 46, height: 25, borderRadius: 999,
              border: `1.5px solid ${t.border}`,
              background: yearly ? t.accent : t.bgSurface,
              cursor: 'pointer', transition: 'background 0.25s', padding: 0, flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
              left: yearly ? 'calc(100% - 22px)' : 3,
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: yearly ? 700 : 400, color: yearly ? t.textPrimary : t.textTertiary, transition: 'color 0.2s' }}>
              Yearly
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
              background: yearly ? `${t.success}22` : t.bgCard,
              color: yearly ? t.success : t.textTertiary,
              border: `1.5px solid ${yearly ? `${t.success}44` : t.border}`,
              transition: 'all 0.25s',
            }}>
              Save {disc}%
            </span>
          </div>
        </div>
      </div>

      {/* ── 3-Column Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        maxWidth: 900,
        margin: '0 auto 36px',
      }}>

        {/* ── FREE ── */}
        <div style={{
          background: t.bgCard,
          border: `1.5px solid ${t.border}`,
          borderRadius: 16, padding: '22px 18px',
          display: 'flex', flexDirection: 'column',
          transition: 'border-color 0.2s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = t.borderAcc; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = t.border; }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textTertiary, marginBottom: 6 }}>Free</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4, color: t.textPrimary }}>₹0</div>
          <p style={{ fontSize: 12, color: t.textTertiary, marginBottom: 14, lineHeight: 1.5 }}>
            Start building your chef presence.
          </p>
          <div style={{ height: 1, background: t.border, marginBottom: 13 }} />
          <div style={{ flex: 1, marginBottom: 16 }}>
            <FRow text="Basic profile listing" accent={t.accent} tertiary={t.textTertiary} />
            <FRow text={`Upload up to ${chefPricingConfig.free_recipes} recipes`} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text={`Upload up to ${chefPricingConfig.free_reels} reels`} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Limited AI Recipe Assistant" accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Verified chef badge" on={false} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="User ratings & reviews" on={false} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Analytics dashboard" on={false} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Monetization" on={false} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Support" on={false} accent={t.accent} tertiary={t.textTertiary} />
          </div>
          <button
            onClick={() => router.push('/chef-dashboard')}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 10,
              border: `1.5px solid ${t.border}`, background: 'transparent',
              color: t.textPrimary, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.accentBg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            Current Plan
          </button>
        </div>

        {/* ── PRO ── */}
        <div style={{
          background: 'linear-gradient(155deg,#2A1E14 0%,#1C1610 55%,#13110E 100%)',
          border: `1.5px solid ${t.borderAcc}`,
          borderRadius: 16, padding: '22px 18px',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
          boxShadow: `0 0 28px ${t.accent}22`,
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = t.accent; el.style.boxShadow = `0 0 42px ${t.accent}38`; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = t.borderAcc; el.style.boxShadow = `0 0 28px ${t.accent}22`; }}
        >
          {/* Badge */}
          <div style={{
            position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
            background: `linear-gradient(135deg,${t.accent},${t.accentHov})`,
            color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
            padding: '3px 14px', borderRadius: 999, textTransform: 'uppercase',
            boxShadow: `0 3px 10px ${t.accent}55`, whiteSpace: 'nowrap',
          }}>
            ✦ Most Popular
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.accent, marginBottom: 6 }}>Chef Pro</div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginBottom: 2 }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: t.textPrimary }}>₹{showPrice}</span>
            <span style={{ fontSize: 12, color: t.textTertiary, paddingBottom: 4 }}>/mo</span>
          </div>

          {yearly ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: t.textTertiary, textDecoration: 'line-through' }}>₹{mp * 12}/yr</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                background: `${t.success}22`, color: t.success,
                border: `1px solid ${t.success}44`,
              }}>
                Save {disc}%
              </span>
            </div>
          ) : <div style={{ height: 16 }} />}

          {yearly && <p style={{ fontSize: 11, color: t.textTertiary, marginBottom: 4 }}>Billed ₹{annualTotal} / year</p>}

          <p style={{ fontSize: 12, color: t.textTertiary, marginBottom: 14, lineHeight: 1.5 }}>
            For serious chefs growing their audience.
          </p>
          <div style={{ height: 1, background: `${t.accent}22`, marginBottom: 13 }} />

          <div style={{ flex: 1, marginBottom: 16 }}>
            <FRow text="Verified chef profile badge" accent={t.accent} tertiary={t.textTertiary} />
            <FRow text={`Upload up to ${chefPricingConfig.pro_recipes} recipes`} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text={`Upload up to ${chefPricingConfig.pro_reels} reels`} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Full AI Recipe Assistant" accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="User ratings & reviews" accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Email support" accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Advanced analytics" on={false} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Monetization" on={false} accent={t.accent} tertiary={t.textTertiary} />
            <FRow text="Dedicated account manager" on={false} accent={t.accent} tertiary={t.textTertiary} />
          </div>

          <button style={{
            width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg,${t.accent},${t.accentHov})`,
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: `0 4px 14px ${t.accent}44`,
            transition: 'opacity 0.15s, transform 0.15s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.9'; el.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; el.style.transform = 'none'; }}
          >
            Upgrade to Pro →
          </button>
          <p style={{ fontSize: 10, color: t.textTertiary, textAlign: 'center', marginTop: 8 }}>
            Cancel anytime · Secure payment
          </p>
        </div>

        {/* ── ENTERPRISE ── */}
        <div style={{
          background: t.bgCard,
          border: `1.5px solid ${t.border}`,
          borderRadius: 16, padding: '22px 18px',
          display: 'flex', flexDirection: 'column',
          transition: 'border-color 0.2s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,184,75,0.4)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = t.border; }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.warning, marginBottom: 6 }}>Enterprise</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4, color: t.textPrimary }}>Custom</div>
          <p style={{ fontSize: 12, color: t.textTertiary, marginBottom: 14, lineHeight: 1.5 }}>
            For culinary brands &amp; large operations.
          </p>
          <div style={{ height: 1, background: t.border, marginBottom: 13 }} />
          <div style={{ flex: 1, marginBottom: 16 }}>
            <FRow text="Featured profile (top placement)" accent={t.warning} tertiary={t.textTertiary} />
            <FRow text="Unlimited recipe uploads" accent={t.warning} tertiary={t.textTertiary} />
            <FRow text="Unlimited reels + priority CDN" accent={t.warning} tertiary={t.textTertiary} />
            <FRow text="Full AI Recipe Assistant" accent={t.warning} tertiary={t.textTertiary} />
            <FRow text="User ratings & reviews" accent={t.warning} tertiary={t.textTertiary} />
            <FRow text="Advanced analytics + reports" accent={t.warning} tertiary={t.textTertiary} />
            <FRow text="Recipe sales & subscriptions" accent={t.warning} tertiary={t.textTertiary} />
            <FRow text="Dedicated account manager" accent={t.warning} tertiary={t.textTertiary} />
          </div>
          <button
            style={{
              width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg,${t.warning}CC,#C47A10)`,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', boxShadow: `0 4px 14px ${t.warning}33`,
              transition: 'opacity 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.88'; el.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; el.style.transform = 'none'; }}
          >
            Contact Us
          </button>
          <p style={{ fontSize: 10, color: t.textTertiary, textAlign: 'center', marginTop: 8 }}>
            Custom pricing · Priority onboarding
          </p>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{
        maxWidth: 560, margin: '0 auto',
        background: `linear-gradient(135deg,${t.accent}18,${t.accentHov}0A)`,
        border: `1.5px solid ${t.borderAcc}`,
        borderRadius: 16, padding: '26px 22px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 26, marginBottom: 8 }}>🍳</div>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em', color: t.textPrimary }}>
          Ready to grow your chef career?
        </h3>
        <p style={{ fontSize: 13, color: t.textSecondary, marginBottom: 18, lineHeight: 1.6 }}>
          Join top chefs on Chefsy — share your recipes, build a following, and earn from your culinary passion.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            padding: '10px 22px', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg,${t.accent},${t.accentHov})`,
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: `0 3px 12px ${t.accent}44`,
            transition: 'opacity 0.15s,transform 0.15s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.9'; el.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; el.style.transform = 'none'; }}
          >
            Upgrade to Pro →
          </button>
          <button
            onClick={() => router.push('/chef-dashboard')}
            style={{
              padding: '10px 22px', borderRadius: 10,
              border: `1.5px solid ${t.border}`, background: 'transparent',
              color: t.textPrimary, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = t.accentBg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            Stay on Free
          </button>
        </div>
        <p style={{ fontSize: 10, color: t.textTertiary, marginTop: 12 }}>
          No credit card required · Cancel Pro anytime
        </p>
      </div>

    </div>
  );
}
