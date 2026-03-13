 'use client';
import React from 'react';

export default function ChefTip({ tip }: { tip: string }) {
  if (!tip) return null;
  return (
    <div className="tip-box mt-4 p-3 rounded-md bg-[#2e2a24] text-white">
      <div className="flex items-start gap-3">
        <div className="tip-icon text-2xl">👨‍🍳</div>
        <div>
          <div className="font-semibold">Chef's Tip:</div>
          <p className="text-sm">{tip}</p>
        </div>
      </div>
    </div>
  );
}

