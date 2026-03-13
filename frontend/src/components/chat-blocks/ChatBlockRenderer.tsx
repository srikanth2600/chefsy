'use client';

import React from 'react';
import TextBlock from './TextBlock';
import RecipeCard from './RecipeCard';
import YouTubeEmbed from './YouTubeEmbed';
import AdBanner from './AdBanner';
import ActionButton from './ActionButton';

export type ChatBlock = {
  block_type: 'text' | 'recipe' | 'video' | 'ad' | 'cta';
  content_json: Record<string, unknown>;
  display_order?: number;
};

export default function ChatBlockRenderer({
  block,
  recipe,
}: {
  block: ChatBlock;
  recipe?: Record<string, unknown> | null;
}) {
  const type = block.block_type;
  const content = block.content_json || {};

  switch (type) {
    case 'text':
      return <TextBlock content={content as { text?: string }} />;
    case 'recipe':
      return <RecipeCard content={content as { recipe_id?: number }} recipe={recipe ?? null} />;
    case 'video':
      return <YouTubeEmbed content={content as { videos?: unknown[] }} />;
    case 'ad':
      return <AdBanner content={content as { ad_id?: number; title?: string }} />;
    case 'cta':
      return <ActionButton content={content as { label?: string; url?: string }} recipe={recipe ?? undefined} />;
    default:
      return null;
  }
}
