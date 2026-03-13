'use client';

/**
 * AdBanner  (src/components/chat-blocks/AdBanner.tsx)
 * ──────────────────────────────────────────────────────
 * Old: visible bordered box that competed with recipe content.
 * New: single quiet line, barely visible. Ads should never
 *      distract from the recipe — the user came here to cook.
 */

import React from 'react';

export default function AdBanner({
  content,
}: {
  content: { ad_id?: number; title?: string; url?: string; description?: string };
}) {
  const { title, url = '#', description } = content ?? {};
  if (!title) return null; // render nothing if empty

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 12px', borderRadius: 8,
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      opacity: 0.6, marginBottom: 4,
    }}>
      <div>
        <span style={{ fontSize: 10, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 8 }}>Ad</span>
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          {title}{description && <span style={{ color: 'var(--text-tertiary)' }}> — {description}</span>}
        </a>
      </div>
      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--text-disabled)', flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </div>
  );
}
