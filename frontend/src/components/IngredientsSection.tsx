 'use client';
import React from 'react';
import { CATEGORY_LABELS, COLORS } from '@/constants/recipeTheme';
import { CATEGORY_EMOJIS } from '@/app/ingredientEmojis';

export default function IngredientsSection({ categories }: { categories: any }) {
  const present = Object.entries(categories || {}).filter(([_, items]) => items && items.length > 0);

  const resolveCategory = (cat: string) => {
    // Try direct label lookup
    let label = (CATEGORY_LABELS as any)[cat] ?? '';
    let color = (COLORS.categories as any)[cat];
    let emoji: string | undefined;

    // If cat looks like an emoji (e.g. '🔴'), try to find matching key
    if (!label || label === cat) {
      const maybeEmoji = String(cat);
      const foundKey = Object.keys(CATEGORY_EMOJIS).find((k) => (CATEGORY_EMOJIS as any)[k] === maybeEmoji);
      if (foundKey) {
        const keyLower = foundKey.toLowerCase().replace(/s$/, '');
        label = ({
          proteins: 'Proteins',
          vegetables: 'Vegetables',
          dairy: 'Dairy',
          spices: 'Spices',
          herbs: 'Herbs & Aromatics',
          liquids: 'Liquids & Oils',
          grains: 'Grains & Pulses',
          fruits: 'Fruits',
          other: 'Other',
        } as Record<string, string>)[keyLower] ?? foundKey;
        color = (COLORS.categories as any)[keyLower];
        emoji = (CATEGORY_EMOJIS as any)[foundKey];
      }
    } else {
      // If we found a label via CATEGORY_LABELS, try to find corresponding emoji by key
      const key = Object.keys(CATEGORY_LABELS).find((k) => (CATEGORY_LABELS as any)[k] === label);
      if (key) {
        const upperKey = key.toUpperCase();
        emoji = (CATEGORY_EMOJIS as any)[upperKey];
      }
    }

    // Fallbacks
    if (!emoji) {
      // if cat itself is emoji, use it
      if (Object.values(CATEGORY_EMOJIS).includes(cat)) emoji = cat;
      else emoji = undefined;
    }

    return { label: label || cat, color: color ?? '#444', emoji };
  };
  return (
    <div className="ingredients-section mb-6 text-left">
      <div className="section-label text-white font-semibold mb-2">Ingredients</div>
      <hr className="border-t border-dotted border-white/10 my-2" />
      <div className="legend flex gap-4 mb-3 flex-wrap">
        {present.map(([cat]) => {
          const resolved = resolveCategory(cat);
          return (
            <div key={cat} className="legend-item flex items-center gap-2 text-xs text-white opacity-90">
              <div style={{ width: 8, height: 8, background: resolved.color ?? '#444', borderRadius: 999 }} />
              <div className="text-white text-xs">{resolved.label}</div>
            </div>
          );
        })}
      </div>
      <hr className="border-t border-dotted border-white/10 my-2" />
      {present.map(([category, ingredients]: any) => {
        const resolved = resolveCategory(category);
        return (
          <div key={category} className="ingredient-section mb-4">
            <ul className="ingredient-list list-none space-y-2">
              {ingredients.map((ing: any, idx: number) => (
                <li key={idx} className="ingredient-item flex items-center justify-between gap-3 text-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-xl flex-shrink-0">{ing.emoji}</div>
                    <div className="font-medium text-sm truncate text-left">{ing.name}</div>
                  </div>
                  <div className="text-xs opacity-80 flex items-center gap-2 flex-shrink-0">
                    <span className="mr-1">-</span>
                    <span>{ing.quantity || ''}{ing.unit ? ` ${ing.unit}` : ''}</span>
                    {resolved.emoji ? <span className="ml-2 text-sm">{resolved.emoji}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
