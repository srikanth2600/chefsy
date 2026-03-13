'use client';
import React from 'react';

export default function SearchBar({
  value,
  onChange,
  onSubmit,
  loading,
  providers,
  selectedProvider,
  onProviderChange,
}: {
  value: string;
  onChange: (v: any) => void;
  onSubmit: (text?: string, mode?: 'Text' | 'Image' | 'Video', module?: string) => void;
  loading: boolean;
  providers?: { id: string; label: string }[];
  selectedProvider?: string | null;
  onProviderChange?: (p: string) => void;
}) {
  const isSubmitAllowed = Boolean(value.trim()) && !loading;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 flex justify-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isSubmitAllowed) onSubmit(value, 'Text', selectedProvider ?? undefined);
        }}
        className="w-full"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-full px-4 py-2 shadow-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <input
              id="recipe"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder-white placeholder-opacity-50 text-white"
              placeholder="Ask for a recipe, ingredients, or cooking tips..."
            />
            {providers && providers.length > 0 && (
              <select
                value={selectedProvider ?? ''}
                onChange={(e) => onProviderChange && onProviderChange(e.target.value)}
                className="ml-2 rounded-full px-3 py-1 text-sm text-white bg-[#2a2a2a] border border-white/10"
                title="Select model/provider"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#2e2a24] text-white">
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={!isSubmitAllowed}
              aria-disabled={!isSubmitAllowed}
              className={`ml-2 rounded-full px-4 py-2 text-white text-sm flex items-center justify-center transition-opacity duration-150 ${
                !isSubmitAllowed ? 'bg-orange-300 opacity-60 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              <span>{loading ? 'Sending...' : 'Send'}</span>
            </button>
          </div>
          {/* Image and Video modes hidden for Phase 2 */}
        </div>
      </form>
    </div>
  );
}

