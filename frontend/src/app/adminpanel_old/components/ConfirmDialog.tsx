 'use client';
import React from 'react';

export default function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-[#1e1c19] rounded p-6">
        <p className="text-white/80 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 bg-gray-700 rounded text-white" onClick={onCancel}>Cancel</button>
          <button className="px-3 py-2 bg-red-600 rounded text-white" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

