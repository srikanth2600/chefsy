'use client';
import React from 'react';
import RecipeHeader from './RecipeHeader';
import IngredientsSection from './IngredientsSection';
import StepsSection from './StepsSection';
import ChefTip from './ChefTip';

export default function RecipeTextView({ recipe, logoUrl, recipeImageUrl }: { recipe: any; logoUrl: string; recipeImageUrl?: string }) {
  const avatarUrl = recipeImageUrl || logoUrl;

  // tips: new field — array of strings. Join for ChefTip which expects a single string,
  // or render each individually if multiple.
  const tips: string[] = Array.isArray(recipe.tips) ? recipe.tips : recipe.tip ? [recipe.tip] : [];

  return (
    <div className="recipe-response">
      <RecipeHeader recipe={recipe} logoUrl={logoUrl} recipeImageUrl={avatarUrl} />
      <IngredientsSection categories={recipe.categories} />
      <hr className="my-4 border-t border-dotted border-white/10" />
      <StepsSection steps={recipe.steps} recipeKey={recipe.recipe_key as string} />
      {/* Render each tip as its own ChefTip block */}
      {tips.map((tip, i) => (
        <ChefTip key={i} tip={tip} />
      ))}
    </div>
  );
}
