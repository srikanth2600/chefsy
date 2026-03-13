'use client';

/**
 * RecipeCard  —  src/components/chat-blocks/RecipeCard.tsx
 * ══════════════════════════════════════════════════════════
 *
 * Bridge between ChatBlockRenderer and RecipeMarkdown.
 * Handles:
 *  • Single recipe: { title, ingredients[], steps[], ... }
 *  • Multi-recipe:  { recipes: [ {...}, {...} ] }
 *  • ⚡ cached/from_cache flag → shows "Instant" badge
 */

import React from 'react';
import RecipeMarkdown from '@/components/RecipeMarkdown';

function isCached(r: Record<string, unknown>): boolean {
  return r.cached === true || (r as any).from_cache === true;
}

export default function RecipeCard({
  content,
  recipe,
}: {
  content: { recipe_id?: number };
  recipe: Record<string, unknown> | null;
}) {
  if (!recipe) return null;

  // Multi-recipe envelope: { recipes: [...] }
  const multi = (recipe as any).recipes;
  if (Array.isArray(multi) && multi.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        {multi.map((r: Record<string, unknown>, i: number) => (
          <RecipeMarkdown key={i} recipe={r as Record<string, any>} cached={isCached(r)} index={i} />
        ))}
      </div>
    );
  }

  // Single recipe
  return <RecipeMarkdown recipe={recipe as Record<string, any>} cached={isCached(recipe)} />;
}
