 'use client';
import React from 'react';

export default function Pagination({ total, page, perPage, onPage }: { total: number; page: number; perPage: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-white/60">Showing page {page} of {pages} — {total} items</div>
      <div className="flex gap-2">
        <button className="px-2 py-1 bg-[#231f1b] rounded disabled:opacity-50" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>Prev</button>
        <button className="px-2 py-1 bg-[#231f1b] rounded disabled:opacity-50" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>Next</button>
      </div>
    </div>
  );
}

