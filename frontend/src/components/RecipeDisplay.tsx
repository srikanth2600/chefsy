'use client';
import React from 'react';
import RecipeTextView from './RecipeTextView';
import RecipePosterCanvas from './RecipePosterCanvas';

export default function RecipeDisplay({ recipe, mode, logoUrl, recipeImageUrl }: { recipe: any; mode: 'text' | 'poster'; logoUrl: string; recipeImageUrl?: string }) {
  if (!recipe) return null;
  const imageUrl = recipeImageUrl || logoUrl;
  if (mode === 'poster') return <RecipePosterCanvas recipe={recipe} logoUrl={logoUrl} recipeImageUrl={imageUrl} />;
  return <RecipeTextView recipe={recipe} logoUrl={logoUrl} recipeImageUrl={imageUrl} />;
}

