 'use client';
 import React, { useEffect, useRef, useState } from 'react';

 export default function RecipePosterCanvas({ recipe, logoUrl, recipeImageUrl, template = 'minimal' }: { recipe: any; logoUrl: string; recipeImageUrl?: string; template?: 'minimal'|'photo-hero' }) {
   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const [ready, setReady] = useState(false);

   useEffect(() => {
     if (!recipe || !canvasRef.current) return;
     const canvas = canvasRef.current;
     const ctx = canvas.getContext('2d')!;
     const width = 1200;
     const height = 1600;
     canvas.width = width;
     canvas.height = height;

     // Helpers
     const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
       const words = text.split(' ');
       let line = '';
       for (let n = 0; n < words.length; n++) {
         const testLine = line + words[n] + ' ';
         const metrics = context.measureText(testLine);
         if (metrics.width > maxWidth && n > 0) {
           context.fillText(line, x, y);
           line = words[n] + ' ';
           y += lineHeight;
         } else {
           line = testLine;
         }
       }
       context.fillText(line.trim(), x, y);
       return y;
     };

    // Choose palette and layout by template (ignore recipe-provided emojis/colors)
    const palettes: Record<string, any> = {
      minimal: {
        background: '#fffaf0',
        accent: '#e85a4f',
        text: '#111827',
        muted: '#6b7280',
      },
      'photo-hero': {
        background: '#0f1724',
        accent: '#f97316',
        text: '#f8fafc',
        muted: '#9ca3af',
      },
    };
    const p = palettes[template] || palettes.minimal;

    // Clear and background
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = p.background;
    ctx.fillRect(0, 0, width, height);

    // Template-specific header/hero
    if (template === 'minimal') {
      // simple accent stripe
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, 0, width, 140);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px Inter, sans-serif';
      const title = (recipe.name || recipe.title || 'Recipe').toString();
      ctx.fillText(title, 60, 92);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillStyle = '#ffffffcc';
      const meta = `${recipe.servings ? `👥 ${recipe.servings}` : ''} ${recipe.time ? ` • ⏱ ${recipe.time}` : ''}`;
      ctx.fillText(meta.trim(), 60, 120);
    } else {
      // photo-hero: large rounded hero rectangle with gradient
      const grad = ctx.createLinearGradient(0, 0, width, 220);
      grad.addColorStop(0, p.accent);
      grad.addColorStop(1, '#7c2d12');
      ctx.fillStyle = grad;
      const r = 28;
      // rounded rect
      ctx.beginPath();
      ctx.moveTo(0 + r, 0);
      ctx.lineTo(width - r, 0);
      ctx.quadraticCurveTo(width, 0, width, r);
      ctx.lineTo(width, 220 - r);
      ctx.quadraticCurveTo(width, 220, width - r, 220);
      ctx.lineTo(r, 220);
      ctx.quadraticCurveTo(0, 220, 0, 220 - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();

      // decorative circle
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.arc(width - 140, 110, 80, 0, Math.PI * 2);
      ctx.fill();

      // title over hero
      ctx.fillStyle = p.text;
      ctx.font = 'bold 44px Inter, sans-serif';
      const title2 = (recipe.name || recipe.title || 'Recipe').toString();
      ctx.fillText(title2, 60, 110);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillStyle = p.muted;
      const meta2 = `${recipe.servings ? `Serves ${recipe.servings}` : ''} ${recipe.time ? ` • ${recipe.time}` : ''}`;
      ctx.fillText(meta2.trim(), 60, 140);
    }

     // Recipe image or logo (top-right)
     const topRightImageUrl = recipeImageUrl || logoUrl;
     if (topRightImageUrl) {
       const img = new Image();
       img.crossOrigin = 'anonymous';
       img.src = topRightImageUrl;
       img.onload = () => {
         const iw = 80;
         const ih = 80;
         ctx.drawImage(img, width - iw - 60, 30, iw, ih);
       };
     }

    // Left column - Ingredients (render as stylized tags)
    const leftX = 60;
    let y = 200;
    ctx.fillStyle = template === 'photo-hero' ? p.text : '#111827';
    ctx.font = '20px Inter, sans-serif';
    ctx.fillText('Ingredients', leftX, y);
    y += 34;
    ctx.font = '16px Inter, sans-serif';
    const ingredients = Object.values(recipe.categories || {}).flatMap((arr: any) => arr).slice(0, 18);
    const tagW = 220;
    const gap = 12;
    let tx = leftX;
    let rowHeight = 0;
    ingredients.forEach((ing: any, i: number) => {
      const name = (ing && ing.name) ? ing.name : String(ing || '');
      // draw tag background
      const tagH = 34;
      ctx.fillStyle = template === 'photo-hero' ? '#0b1220' : '#f3f4f6';
      ctx.roundRect(tx, y, tagW, tagH, 8);
      ctx.fill();
      // text
      ctx.fillStyle = template === 'photo-hero' ? p.text : '#111827';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(name, tx + 12, y + 22);
      tx += tagW + gap;
      rowHeight = Math.max(rowHeight, tagH);
      if (tx + tagW > 560) {
        tx = leftX;
        y += rowHeight + gap;
        rowHeight = 0;
      }
      if (y > 480) return;
    });

    if (y < 520) {
      y += 10;
    }

     // Nutrition box
     const nutX = leftX;
     const nutY = 520;
    ctx.fillStyle = template === 'photo-hero' ? '#071018' : '#ffffff';
    ctx.fillRect(nutX, nutY, 520, 220);
    ctx.strokeStyle = template === 'photo-hero' ? p.accent : p.accent;
     ctx.lineWidth = 4;
     ctx.strokeRect(nutX, nutY, 520, 220);
    ctx.fillStyle = template === 'photo-hero' ? p.text : '#222';
    ctx.font = '20px Inter, sans-serif';
    ctx.fillText('Nutrition', nutX + 20, nutY + 36);
     ctx.font = '16px Inter, sans-serif';
     const nutrition = recipe.nutrition_total || recipe.nutrition || {};
     const nutEntries = Array.isArray(nutrition) ? nutrition.slice(0, 6) : Object.entries(nutrition).slice(0, 6);
     let ny = nutY + 68;
     nutEntries.forEach((e: any) => {
       const line = Array.isArray(e) ? `${e[0]}: ${e[1]}` : `${e[0]}: ${e[1]}`;
       ctx.fillText(line, nutX + 20, ny);
       ny += 26;
     });

     // Right column - Steps
     const rightX = 620;
     let ry = 200;
    ctx.fillStyle = template === 'photo-hero' ? p.text : '#fff';
    ctx.font = '22px Inter, sans-serif';
    ctx.fillText('Steps', rightX, ry);
    ctx.fillStyle = template === 'photo-hero' ? p.text : '#222';
    ctx.font = '18px Inter, sans-serif';
     ry += 36;
     const steps = recipe.steps || [];
     steps.forEach((s: any, idx: number) => {
       const text = typeof s === 'string' ? s : (s.description || s.title || '');
       const prefix = `${idx + 1}. `;
       ctx.fillText(prefix, rightX, ry);
       wrapText(ctx, text, rightX + 28, ry, 520, 26);
       ry += 54;
     });

     // Footer
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = template === 'photo-hero' ? p.muted : '#666';
    ctx.fillText('Generated by Gharka Chef', 60, height - 40);

     setReady(true);
   }, [recipe, logoUrl, recipeImageUrl]);

   const handleDownload = () => {
     const canvas = canvasRef.current;
     if (!canvas) return;
     const link = document.createElement('a');
     link.download = `${(recipe.name || 'recipe').toLowerCase().replace(/\s+/g, '-')}-poster.png`;
     link.href = canvas.toDataURL('image/png');
     link.click();
   };

   return (
     <div>
       <div className="poster-actions mb-4 flex gap-2">
         <button className="px-3 py-1 rounded bg-orange-500 text-white text-sm" onClick={handleDownload} disabled={!ready}>⬇️ Download</button>
         <button className="px-3 py-1 rounded bg-transparent text-white text-sm" onClick={() => { const canvas = canvasRef.current; if (!canvas) return; const data = canvas.toDataURL(); const wa = `https://wa.me/?text=${encodeURIComponent((recipe.name||'') + ' ' + data)}`; window.open(wa, '_blank'); }}>🔗 Share</button>
       </div>
       <div style={{ background: '#1a1815', padding: 20, borderRadius: 8 }}>
         <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
       </div>
     </div>
   );
 }

