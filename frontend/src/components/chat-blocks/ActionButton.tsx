'use client';

/**
 * ActionButton  (src/components/chat-blocks/ActionButton.tsx)
 * ─────────────────────────────────────────────────────────────
 * Old: two big orange gradient buttons that competed with the recipe.
 * New: subtle inline text links that sit quietly below the recipe.
 *      "Find a chef" + "Watch video" — secondary actions only.
 */

import React, { useState } from 'react';
import Link from 'next/link';

export default function ActionButton({
  content,
  recipe,
}: {
  content: { label?: string; url?: string };
  recipe?: Record<string, unknown>;
}) {
  const label       = content?.label ?? 'Find a chef near you';
  const url         = content?.url   ?? '/find-chef';
  const recipeTitle = String((recipe && (recipe.title || recipe.name)) || '');
  const [videoSearched, setVideoSearched] = useState(false);

  const handleVideo = () => {
    setVideoSearched(true);
    try { window.dispatchEvent(new CustomEvent('requestVideoSearch', { detail: { title: recipeTitle } })); } catch {}
    setTimeout(() => setVideoSearched(false), 3000);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      {/* Find a chef */}
      <Link href={url} style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
      >
        👨‍🍳 {label}
      </Link>

      {/* Watch video */}
      <button type="button" onClick={handleVideo}
        style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'}
      >
        {videoSearched ? '⏳ Searching…' : '▶ Watch video'}
      </button>
    </div>
  );
}
