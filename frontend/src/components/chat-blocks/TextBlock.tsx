'use client';

/**
 * TextBlock  (src/components/chat-blocks/TextBlock.tsx)
 * ───────────────────────────────────────────────────────
 * Renders assistant text using CSS variables (dark + light aware).
 * Filters raw JSON strings that sometimes leak before stream finalises.
 */

import React from 'react';

export default function TextBlock({ content }: { content: { text?: string } }) {
  const text = (content?.text ?? '').trim();
  if (!text) return null;
  // Don't render raw JSON — the stream finaliser handles showing the recipe card
  if (text.startsWith('{') || text.startsWith('[')) return null;
  return (
    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 4px', padding: 0 }}>
      {text}
    </p>
  );
}
