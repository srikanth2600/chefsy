'use client';

/**
 * /adminpanel/messages
 * Admin view of all chef inbox messages.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Pagination } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type Message = {
  id: number;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
  chef_name: string;
  chef_id?: number;
};

export default function MessagesAdminPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState('');
  const [chefId, setChefId]     = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const perPage = 20;

  const load = useCallback(async (pg = 1) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (q)          p.set('q',       q);
      if (chefId)     p.set('chef_id', chefId);
      if (readFilter) p.set('is_read', readFilter);
      const r = await fetch(`${API}/admin/messages?${p}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setMessages(Array.isArray(j.messages) ? j.messages : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
      setPage(pg);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [q, chefId, readFilter]); // eslint-disable-line

  useEffect(() => { load(1); }, []); // eslint-disable-line

  const doDelete = async (id: number) => {
    if (!confirm('Delete this message permanently?')) return;
    setDeleting(id);
    try {
      await fetch(`${API}/admin/messages/${id}`, { method: 'DELETE', headers: hdr() });
      if (selected?.id === id) setSelected(null);
      await load(page);
    } finally { setDeleting(null); }
  };

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">💬 Messages</div>
          <div className="adm-ph-sub">All chef inbox messages from users · {total} total</div>
        </div>
      </div>

      {/* Stats */}
      <div className="adm-stats adm-mb3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
        {[
          { color: 'c-orange', icon: '💬', label: 'Total Messages', value: total },
          { color: 'c-red',    icon: '●',  label: 'Unread',         value: unreadCount },
          { color: 'c-green',  icon: '✓',  label: 'Read',           value: messages.filter(m => m.is_read).length },
        ].map((s, i) => (
          <div key={i} className={`adm-stat ${s.color}`}>
            <div className="adm-stat-icon" style={{ fontSize: 18 }}>{s.icon}</div>
            <div className="adm-stat-val">{loading ? <span className="adm-sk" style={{ display: 'block', height: 24, width: 40 }} /> : s.value}</div>
            <div className="adm-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}

      {/* Filters */}
      <div className="adm-filters">
        <input
          className="adm-input"
          placeholder="Search sender, subject, message…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1)}
        />
        <input
          className="adm-input"
          placeholder="Chef ID"
          value={chefId}
          onChange={e => setChefId(e.target.value)}
          style={{ width: 120 }}
        />
        <select className="adm-select" value={readFilter} onChange={e => { setReadFilter(e.target.value); load(1); }} style={{ width: 'auto' }}>
          <option value="">All messages</option>
          <option value="false">Unread only</option>
          <option value="true">Read only</option>
        </select>
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => load(1)}>Search</button>
        {(q || chefId || readFilter) && (
          <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setQ(''); setChefId(''); setReadFilter(''); load(1); }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Chef</th>
                <th>Subject</th>
                <th>Preview</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--at3)' }}>Loading…</td></tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--at3)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                    No messages found
                  </td>
                </tr>
              ) : messages.map(m => (
                <tr
                  key={m.id}
                  className={selected?.id === m.id ? 'adm-row-selected' : ''}
                  style={{
                    cursor: 'pointer',
                    fontWeight: m.is_read ? 'normal' : 600,
                    background: m.is_read ? undefined : 'var(--ao-faint, rgba(218,119,86,0.04))',
                  }}
                  onClick={() => setSelected(selected?.id === m.id ? null : m)}
                >
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.sender_name || 'Anonymous'}</div>
                    {m.sender_email && <div style={{ fontSize: 11, color: 'var(--at3)' }}>{m.sender_email}</div>}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--at2)' }}>
                    {m.chef_name || <span style={{ color: 'var(--at3)' }}>—</span>}
                    {m.chef_id && <div style={{ fontSize: 11, color: 'var(--at3)' }}>ID: {m.chef_id}</div>}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: m.is_read ? 'normal' : 700, color: 'var(--at1)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.subject || <span style={{ color: 'var(--at3)', fontStyle: 'italic', fontWeight: 'normal' }}>(No subject)</span>}
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: 'var(--at2)', display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.message}
                    </span>
                  </td>
                  <td>
                    {m.is_read
                      ? <span className="adm-badge c-green">Read</span>
                      : <span className="adm-badge c-orange">Unread</span>
                    }
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--at3)', whiteSpace: 'nowrap' }}>
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      className="adm-btn adm-btn-ghost adm-btn-sm"
                      style={{ color: 'var(--ar)' }}
                      disabled={deleting === m.id}
                      onClick={() => doDelete(m.id)}
                    >
                      {deleting === m.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Message detail drawer */}
        {selected && (
          <div style={{
            borderTop: '1px solid var(--ab)',
            padding: '18px 20px',
            background: 'var(--as)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {selected.subject || '(No subject)'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12 }}>
                  <span style={{ color: 'var(--at2)' }}>
                    <strong style={{ color: 'var(--at1)' }}>From:</strong> {selected.sender_name}
                  </span>
                  {selected.sender_email && (
                    <a href={`mailto:${selected.sender_email}`} style={{ color: 'var(--ao)', textDecoration: 'none' }}>
                      {selected.sender_email}
                    </a>
                  )}
                  <span style={{ color: 'var(--at3)' }}>
                    To chef: <strong style={{ color: 'var(--at2)' }}>{selected.chef_name}</strong>
                  </span>
                  <span style={{ color: 'var(--at3)' }}>
                    {new Date(selected.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--at3)', fontSize: 20 }}
              >
                ×
              </button>
            </div>

            <div style={{
              background: 'var(--ab2)',
              border: '1px solid var(--ab)',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 13,
              color: 'var(--at2)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              maxHeight: 220,
              overflowY: 'auto',
            }}>
              {selected.message}
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              {selected.sender_email && (
                <a
                  href={`mailto:${selected.sender_email}?subject=Re: ${encodeURIComponent(selected.subject || '')}`}
                  className="adm-btn adm-btn-primary adm-btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  ↩ Reply via Email
                </a>
              )}
              <button
                className="adm-btn adm-btn-ghost adm-btn-sm"
                style={{ color: 'var(--ar)' }}
                onClick={() => doDelete(selected.id)}
              >
                Delete Message
              </button>
            </div>
          </div>
        )}

        <Pagination page={page} total={total} perPage={perPage} onChange={p => { setPage(p); load(p); }} />
      </div>
    </>
  );
}