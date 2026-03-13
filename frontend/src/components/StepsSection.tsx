'use client';
import React, { useState, useEffect } from 'react';

const apiBase = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005') : '';

export default function StepsSection({ steps, recipeKey }: { steps: any[]; recipeKey?: string }) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [counts, setCounts] = useState<{ likes: number; dislikes: number }>({ likes: 0, dislikes: 0 });
  const [userReaction, setUserReaction] = useState<'like' | 'dislike' | null>(null);

  useEffect(() => {
    if (!recipeKey) return;
    // fetch aggregated recipe-level reactions
    fetch(`${apiBase}/recipes/${encodeURIComponent(recipeKey)}/reactions`)
      .then((r) => r.json())
      .then((j) => {
        setCounts({ likes: j.likes || 0, dislikes: j.dislikes || 0 });
      })
      .catch(() => {});
  }, [recipeKey]);

  const toggle = (i: number) => {
    setCompleted((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  const reactRecipe = async (action: 'like' | 'dislike') => {
    if (!recipeKey) return;
    try {
      const token = localStorage.getItem('gharka_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${apiBase}/recipes/${encodeURIComponent(recipeKey)}/react`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          alert('Please sign in to like/dislike this recipe.');
          return;
        }
        throw new Error('Failed to react');
      }
      const j = await res.json();
      setCounts({ likes: j.likes || 0, dislikes: j.dislikes || 0 });
      setUserReaction(action);
    } catch (e) {
      console.error(e);
    }
  };

  const shareRecipe = () => {
    try {
      const text = `${steps.map((s, i) => `${i + 1}. ${s.title ? s.title + ': ' : ''}${s.description || s}`).join('\\n')}`;
      navigator.clipboard.writeText(text);
      alert('Recipe steps copied to clipboard');
    } catch {
      window.open(`mailto:?body=${encodeURIComponent('Recipe steps')}`);
    }
  };

  return (
    <div className="steps-section mb-6" style={{ position: 'relative', zIndex: 5 }}>
      <div className="section-label text-white font-semibold mb-3">Step-by-Step Method</div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`py-2 ${completed.has(i) ? 'opacity-60 line-through' : ''} border-b border-dotted border-white/10`}
            onClick={() => toggle(i)}
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-start gap-3">
              <div className="w-6 text-white font-semibold">{i + 1}.</div>
              <div className="step-content text-left">
                {s.title ? <div className="step-title font-semibold text-white">{s.title}</div> : null}
                <div className="step-desc text-sm text-white opacity-90">
                  {typeof s === 'string' ? s : (s.description || '')}
                </div>
                {s.time ? <div className="step-time text-xs text-white opacity-70">⏱ {s.time}</div> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="step-hint text-sm text-white opacity-70 mt-2">💡 Tap any step to mark it done while cooking</div>

      {/* Recipe-level actions: like, dislike, share (single counters) */}
      <div className="recipe-actions mt-3 flex items-center gap-3 justify-center" style={{ marginBottom: 160 }}>
        <button
          onClick={() => reactRecipe('like')}
          type="button"
          className={`inline-flex items-center gap-2 px-3 py-1 rounded ${userReaction === 'like' ? 'bg-green-600' : 'bg-transparent'} text-white`}
          aria-label="Like recipe"
        >
          <span className="text-lg">👍</span>
          <span className="text-sm">{counts.likes}</span>
        </button>

        <button
          onClick={() => reactRecipe('dislike')}
          type="button"
          className={`inline-flex items-center gap-2 px-3 py-1 rounded ${userReaction === 'dislike' ? 'bg-red-600' : 'bg-transparent'} text-white`}
          aria-label="Dislike recipe"
        >
          <span className="text-lg">👎</span>
          <span className="text-sm">{counts.dislikes}</span>
        </button>

        <button onClick={shareRecipe} className="inline-flex items-center gap-2 px-3 py-1 rounded bg-orange-500 text-white">
          <span className="text-lg">🔗</span>
          <span className="text-sm">Share</span>
        </button>
      </div>
    </div>
  );
}
