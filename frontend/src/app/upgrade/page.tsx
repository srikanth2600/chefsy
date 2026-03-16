'use client';

/**
 * /upgrade — Chefsy Pricing Page
 * ════════════════════════════════
 * Monthly / Yearly billing toggle · Free vs Premium · Feature comparison
 * Admin-ready: swap pricingConfig values from GET /pricing/plans
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

/* ─── Admin-configurable config ── future: fetch('/api/pricing/plans') ──── */
const pricingConfig = {
  monthly_price: 299,
  yearly_discount: 10,
  ai_recipe_limit_free: 5,
  ai_recipe_limit_paid: 25,
  save_recipe_limit_free: 5,
};

function yearlyTotal(monthly: number, pct: number) {
  return Math.round(monthly * 12 * (1 - pct / 100));
}

/* ─── Icons ────────────────────────────────────────────────────────────── */
const Check = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="10" cy="10" r="10" fill="rgba(92,184,126,0.18)" />
    <path d="M6 10.5l3 3 5-6" stroke="#5CB87E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Cross = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="10" cy="10" r="10" fill="rgba(224,107,107,0.12)" />
    <path d="M7 7l6 6M13 7l-6 6" stroke="#E06B6B" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/* ─── Feature row ────────────────────────────────────────────────────── */
function FRow({ text, on = true }: { text: string; on?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', opacity: on ? 1 : 0.4 }}>
      {on ? <Check /> : <Cross />}
      <span style={{ fontSize: 13, color: on ? 'var(--text-primary)' : 'var(--text-tertiary)', textDecoration: on ? 'none' : 'line-through' }}>
        {text}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════
   PAGE
══════════════════════════════════════════ */
export default function UpgradePage() {
  const router = useRouter();
  const [yearly, setYearly] = useState(false);

  const mp = pricingConfig.monthly_price;
  const disc = pricingConfig.yearly_discount;
  const annualTotal = yearlyTotal(mp, disc);
  const monthlyEquiv = Math.round(annualTotal / 12);
  const showPrice = yearly ? monthlyEquiv : mp;

  return (
    /* Scroll container — overrides `overflow:hidden` on html/body */
    <div style={{
      position: 'fixed', inset: 0,
      overflowY: 'auto', overflowX: 'hidden',
      background: 'var(--bg)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-dm-sans), DM Sans, system-ui, sans-serif',
      zIndex: 10,
    }}>

      {/* ── Nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(19,17,14,0.94)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border)',
        height: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500,
            fontFamily: 'inherit', padding: '5px 8px', borderRadius: 7,
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-primary)'; el.style.background = 'var(--accent-alpha-10)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-secondary)'; el.style.background = 'none'; }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7-7 7 7 7" />
          </svg>
          Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 18 }}>🍳</span>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Chefsy</span>
        </div>
        <div style={{ width: 60 }} />
      </header>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px 48px' }}>

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'var(--accent-alpha-10)', border: '1px solid var(--accent-alpha-30)',
            borderRadius: 999, padding: '3px 12px', marginBottom: 12,
            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
            letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>
            ✦ Pricing Plans
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 8px' }}>
            Choose Your Plan
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 22px', lineHeight: 1.6 }}>
            Unlock AI-powered recipes, meal planning, and chef interactions.
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: yearly ? 400 : 700, color: yearly ? 'var(--text-tertiary)' : 'var(--text-primary)', transition: 'color 0.2s' }}>
              Monthly
            </span>
            <button
              onClick={() => setYearly(v => !v)}
              style={{
                position: 'relative', width: 46, height: 25, borderRadius: 999,
                border: '1.5px solid var(--border-hover)',
                background: yearly ? 'var(--accent)' : 'var(--bg-surface)',
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
              <span style={{ fontSize: 13, fontWeight: yearly ? 700 : 400, color: yearly ? 'var(--text-primary)' : 'var(--text-tertiary)', transition: 'color 0.2s' }}>
                Yearly
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                background: yearly ? 'rgba(92,184,126,0.15)' : 'var(--bg-card)',
                color: yearly ? '#5CB87E' : 'var(--text-tertiary)',
                border: `1.5px solid ${yearly ? 'rgba(92,184,126,0.3)' : 'var(--border)'}`,
                transition: 'all 0.25s',
              }}>
                Save {disc}%
              </span>
            </div>
          </div>
        </div>

        {/* ── Cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: 18, marginBottom: 36,
          maxWidth: 760, margin: '0 auto 36px',
        }}>

          {/* FREE */}
          <div style={{
            background: 'var(--bg-card)', border: '1.5px solid var(--border)',
            borderRadius: 16, padding: '22px 20px',
            display: 'flex', flexDirection: 'column',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border-hover)'; el.style.boxShadow = 'var(--shadow-sm)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--border)'; el.style.boxShadow = 'none'; }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>Free</div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>₹0</div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.5 }}>
              Perfect for exploring chef recipes.
            </p>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
            <div style={{ flex: 1, marginBottom: 18 }}>
              <FRow text="Unlimited Chef Recipes" />
              <FRow text={`AI Recipe Discover — ${pricingConfig.ai_recipe_limit_free}/day`} />
              <FRow text={`Save Recipes — Up to ${pricingConfig.save_recipe_limit_free}`} />
              <FRow text="Nutrition Analysis — Basic" />
              <FRow text="Download Recipe PDF" />
              <FRow text="Chef Access" />
              <FRow text="AI Meal Planner" on={false} />
              <FRow text="Ad-Free Experience" on={false} />
              <FRow text="Comment on Recipes" on={false} />
            </div>
            <button
              onClick={() => router.push('/')}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 10,
                border: '1.5px solid var(--border-hover)', background: 'transparent',
                color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--accent-alpha-10)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; }}
            >
              Get Started
            </button>
          </div>

          {/* PREMIUM */}
          <div style={{
            background: 'linear-gradient(155deg,#2A1E14 0%,#1C1610 55%,#13110E 100%)',
            border: '1.5px solid rgba(218,119,86,0.4)',
            borderRadius: 16, padding: '22px 20px',
            display: 'flex', flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 0 32px rgba(218,119,86,0.14)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(218,119,86,0.6)'; el.style.boxShadow = '0 0 48px rgba(218,119,86,0.22)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(218,119,86,0.4)'; el.style.boxShadow = '0 0 32px rgba(218,119,86,0.14)'; }}
          >
            {/* Badge */}
            <div style={{
              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
              background: 'linear-gradient(135deg,var(--accent),#C45E3A)',
              color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
              padding: '3px 14px', borderRadius: 999, textTransform: 'uppercase',
              boxShadow: '0 3px 10px rgba(218,119,86,0.4)', whiteSpace: 'nowrap',
            }}>
              ✦ Most Popular
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>Premium</div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginBottom: 2 }}>
              <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>₹{showPrice}</span>
              <span style={{ fontSize: 13, color: 'var(--text-tertiary)', paddingBottom: 4 }}>/mo</span>
            </div>

            {yearly ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'line-through' }}>₹{mp * 12}/yr</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                  background: 'rgba(92,184,126,0.15)', color: '#5CB87E',
                  border: '1px solid rgba(92,184,126,0.3)',
                }}>
                  Save {disc}%
                </span>
              </div>
            ) : <div style={{ height: 16 }} />}

            {yearly && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Billed ₹{annualTotal} / year</p>}

            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.5 }}>
              Best for food lovers and home chefs.
            </p>
            <div style={{ height: 1, background: 'rgba(218,119,86,0.15)', marginBottom: 14 }} />

            <div style={{ flex: 1, marginBottom: 18 }}>
              <FRow text="Unlimited AI and Chef Recipes" />
              <FRow text={`AI Recipe Discover — ${pricingConfig.ai_recipe_limit_paid}/day`} />
              <FRow text="Save Recipes — Unlimited" />
              <FRow text="AI Meal Planner" />
              <FRow text="Detailed Nutrition Report" />
              <FRow text="Download Recipe PDF" />
              <FRow text="Ad-Free Experience" />
              <FRow text="Chef Access" />
              <FRow text="Engage with Chef (Comment)" />
            </div>

            <button style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,var(--accent),#C45E3A)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(218,119,86,0.3)',
              transition: 'opacity 0.15s, transform 0.15s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.9'; el.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; el.style.transform = 'none'; }}
            >
              Upgrade Now →
            </button>
            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
              Cancel anytime · Secure payment
            </p>
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div style={{
          maxWidth: 560, margin: '0 auto',
          background: 'linear-gradient(135deg,rgba(218,119,86,0.1),rgba(196,94,58,0.05))',
          border: '1.5px solid rgba(218,119,86,0.22)',
          borderRadius: 16, padding: '28px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👨‍🍳</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>Ready to cook smarter?</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
            Join thousands of home chefs using Chefsy to discover, save, and master recipes with AI.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,var(--accent),#C45E3A)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(218,119,86,0.3)',
              transition: 'opacity 0.15s,transform 0.15s',
            }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '0.9'; el.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.opacity = '1'; el.style.transform = 'none'; }}
            >
              Upgrade Now →
            </button>
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '10px 24px', borderRadius: 10,
                border: '1.5px solid var(--border-hover)', background: 'transparent',
                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-alpha-10)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Continue with Free
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 12 }}>
            No credit card required · Cancel premium anytime
          </p>
        </div>

      </div>
    </div>
  );
}
