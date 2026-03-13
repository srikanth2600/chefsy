 'use client';
import React, { useRef } from 'react';
import html2canvas from 'html2canvas';

export default function RecipePosterView({ recipe, logoUrl }: { recipe: any; logoUrl: string }) {
  const posterRef = useRef<HTMLDivElement | null>(null);

  const handleDownload = async () => {
    if (!posterRef.current) return;
    const canvas = await html2canvas(posterRef.current, { scale: 2, backgroundColor: '#1a0f05', logging: false });
    const link = document.createElement('a');
    link.download = `${(recipe.name || 'recipe').toLowerCase().replace(/\s+/g,'-')}-poster.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleShare = () => {
    const text = `Check out this ${recipe.name} recipe from Gharka Chef!`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="poster-wrapper">
      <div className="poster-actions mb-4 flex gap-2">
        <button className="px-3 py-1 rounded bg-orange-500 text-white text-sm" onClick={handleDownload}>⬇️ Download</button>
        <button className="px-3 py-1 rounded bg-transparent text-white text-sm" onClick={handleShare}>🔗 Share</button>
      </div>
      <div ref={posterRef}>
        {/* Simplified poster layout */}
        <div className="recipe-poster bg-[#231f1b] p-6 rounded-lg">
          <div className="poster-header mb-4">
            <div className="poster-brand flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="logo" className="h-8 w-8" />
                <div className="text-white font-semibold text-sm">{recipe.name}</div>
              </div>
              <div className="flex items-center gap-2 text-xs opacity-90">
                <div>{recipe.servings ? `👥 ${recipe.servings}` : null}</div>
                <div>{recipe.time ? `⏱ ${recipe.time}` : null}</div>
              </div>
            </div>
          </div>
          <div className="poster-body text-white">
            <div className="poster-section-title font-semibold mb-2">Ingredients</div>
            <div className="poster-ingredients grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(recipe.categories || {}).flatMap(([k,v]) => v).slice(0,12).map((ing:any, i:number) => (
                <div key={i} className="poster-ing-tag p-2 bg-[#2e2a24] rounded">
                  <div className="poster-ing-emoji">{ing.emoji}</div>
                  <div className="poster-ing-name text-sm">{ing.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

