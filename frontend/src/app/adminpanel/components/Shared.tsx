'use client';
import React from 'react';

/* ── Modal ── */
export function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void;
  children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="adm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal" style={{ maxWidth: wide ? 720 : 540 }}>
        <div className="adm-modal-hd">
          <span className="adm-modal-title">{title}</span>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adm-modal-bd">{children}</div>
      </div>
    </div>
  );
}

/* ── Modal with footer ── */
export function ModalWithFooter({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void;
  children: React.ReactNode; footer: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="adm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="adm-modal" style={{ maxWidth: wide ? 720 : 540 }}>
        <div className="adm-modal-hd">
          <span className="adm-modal-title">{title}</span>
          <button className="adm-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="adm-modal-bd">{children}</div>
        <div className="adm-modal-ft">{footer}</div>
      </div>
    </div>
  );
}

/* ── Confirm Dialog ── */
export function ConfirmDialog({ title, message, onConfirm, onCancel, danger }: {
  title?: string; message: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className="adm-overlay">
      <div className="adm-confirm">
        <div className="adm-confirm-icon">{danger ? '⚠️' : '❓'}</div>
        {title && <div className="adm-confirm-title">{title}</div>}
        <div className="adm-confirm-msg">{message}</div>
        <div className="adm-confirm-btns">
          <button className="adm-btn adm-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`adm-btn ${danger ? 'adm-btn-danger' : 'adm-btn-primary'}`} onClick={onConfirm}>
            {danger ? 'Yes, delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ── */
export function Pagination({ total, page, perPage, onPage }: {
  total: number; page: number; perPage: number; onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const start = Math.min((page - 1) * perPage + 1, total);
  const end   = Math.min(page * perPage, total);

  // Build page numbers to show: always first, last, and window around current
  const nums: (number | '…')[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 1 && i <= page + 1)) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }

  return (
    <div className="adm-pager">
      <span className="adm-pager-info">
        {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
      </span>
      <div className="adm-pager-btns">
        <button className="adm-pager-btn" onClick={() => onPage(page - 1)} disabled={page <= 1}>‹</button>
        {nums.map((n, i) =>
          n === '…'
            ? <span key={`e${i}`} style={{ color: 'var(--at3)', fontSize: 12, padding: '0 2px' }}>…</span>
            : <button key={n} className={`adm-pager-btn${page === n ? ' active' : ''}`} onClick={() => onPage(n)}>{n}</button>
        )}
        <button className="adm-pager-btn" onClick={() => onPage(page + 1)} disabled={page >= pages}>›</button>
      </div>
    </div>
  );
}

/* ── Detail Row ── */
export function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--ae)' }}>
      <span style={{ width: 130, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--at3)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--at)', flex: 1 }}>{value ?? '—'}</span>
    </div>
  );
}
