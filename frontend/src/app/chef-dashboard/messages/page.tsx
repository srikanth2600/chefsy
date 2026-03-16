'use client';

/**
 * /chef-dashboard/messages
 * Chef inbox — list of messages sent by users, with detail view.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useChefTheme } from '@/components/chef/ChefThemeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

type Message = {
  id: number;
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
  user_full_name?: string;
};

export default function MessagesPage() {
  const { t } = useChefTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const perPage = 20;

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/chefs/me/messages?page=${pg}&per_page=${perPage}`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessages(data.messages || []);
      setTotal(data.total || 0);
      setUnread(data.unread || 0);
      setPage(pg);
    } catch (e: any) {
      setError(e.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const markRead = async (msg: Message) => {
    if (msg.is_read) return;
    try {
      await fetch(`${API}/chefs/me/messages/${msg.id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tok()}` },
      });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
      setUnread(u => Math.max(0, u - 1));
    } catch {}
  };

  const selectMessage = (msg: Message) => {
    setSelected(msg);
    markRead(msg);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div style={{ padding: '24px', color: t.textPrimary, fontFamily: 'var(--font-dm-sans), DM Sans, system-ui, sans-serif', height: 'calc(100vh - 0px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: t.textPrimary, letterSpacing: '-0.02em' }}>
            💬 Messages
          </h1>
          {unread > 0 && (
            <span style={{
              background: t.accent, color: '#fff',
              fontSize: 10, fontWeight: 700, padding: '2px 8px',
              borderRadius: 999, letterSpacing: '0.05em',
            }}>
              {unread} new
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: t.textTertiary, margin: '4px 0 0' }}>
          Messages from users who reached out to you
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: `${t.error}18`, border: `1px solid ${t.error}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: t.error, fontSize: 13, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Layout: list + detail */}
      <div style={{ display: 'flex', flex: 1, gap: 14, minHeight: 0 }}>

        {/* Message list */}
        <div style={{
          width: 320, flexShrink: 0,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          borderRadius: 12, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary }}>Inbox</span>
            <span style={{ fontSize: 11, color: t.textTertiary, marginLeft: 8 }}>{total} messages</span>
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>Loading…</div>
          ) : messages.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <p style={{ fontSize: 13, color: t.textTertiary, margin: 0 }}>No messages yet</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {messages.map(m => (
                <button
                  key={m.id}
                  onClick={() => selectMessage(m)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '12px 16px',
                    borderBottom: `1px solid ${t.border}`,
                    border: 'none',
                    background: selected?.id === m.id ? t.accentBg : m.is_read ? 'transparent' : `${t.accent}0A`,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'background 0.12s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (selected?.id !== m.id) (e.currentTarget as HTMLElement).style.background = t.bgSurface; }}
                  onMouseLeave={e => { if (selected?.id !== m.id) (e.currentTarget as HTMLElement).style.background = m.is_read ? 'transparent' : `${t.accent}0A`; }}
                >
                  {/* Unread dot */}
                  {!m.is_read && (
                    <span style={{
                      position: 'absolute', top: 16, right: 14,
                      width: 7, height: 7, borderRadius: '50%',
                      background: t.accent,
                    }} />
                  )}
                  <p style={{
                    fontSize: 12, fontWeight: m.is_read ? 500 : 700,
                    color: t.textPrimary, margin: '0 0 2px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    paddingRight: 16,
                  }}>
                    {m.sender_name || 'Anonymous'}
                  </p>
                  <p style={{
                    fontSize: 11, color: t.accent, margin: '0 0 3px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}>
                    {m.subject || '(No subject)'}
                  </p>
                  <p style={{
                    fontSize: 11, color: t.textTertiary, margin: '0 0 4px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.message}
                  </p>
                  <p style={{ fontSize: 10, color: t.textTertiary, margin: 0 }}>
                    {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '10px 14px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 6, justifyContent: 'center', flexShrink: 0 }}>
              <button onClick={() => load(page - 1)} disabled={page <= 1}
                style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: page <= 1 ? t.textTertiary : t.textPrimary, cursor: page <= 1 ? 'default' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                ←
              </button>
              <span style={{ fontSize: 11, color: t.textTertiary, alignSelf: 'center' }}>{page}/{totalPages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= totalPages}
                style={{ padding: '4px 10px', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: page >= totalPages ? t.textTertiary : t.textPrimary, cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                →
              </button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div style={{
          flex: 1,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          borderRadius: 12, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {selected ? (
            <>
              {/* Message header */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px', color: t.textPrimary }}>
                      {selected.subject || '(No subject)'}
                    </h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                      <span style={{ fontSize: 12, color: t.textSecondary }}>
                        <strong style={{ color: t.textPrimary }}>From:</strong> {selected.sender_name || 'Anonymous'}
                      </span>
                      {selected.sender_email && (
                        <span style={{ fontSize: 12, color: t.accent }}>{selected.sender_email}</span>
                      )}
                      <span style={{ fontSize: 11, color: t.textTertiary }}>
                        {new Date(selected.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary, fontSize: 20, padding: 0, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Message body */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                <div style={{
                  background: t.bgSurface, border: `1px solid ${t.border}`,
                  borderRadius: 10, padding: '16px 18px',
                  fontSize: 14, color: t.textSecondary, lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {selected.message}
                </div>

                {/* Reply hint */}
                {selected.sender_email && (
                  <div style={{ marginTop: 16 }}>
                    <a
                      href={`mailto:${selected.sender_email}?subject=Re: ${encodeURIComponent(selected.subject || '')}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '9px 18px', borderRadius: 9,
                        background: `linear-gradient(135deg,${t.accent},${t.accentHov})`,
                        color: '#fff', fontSize: 13, fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      ↩ Reply via Email
                    </a>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: t.textTertiary }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
              <p style={{ fontSize: 14, margin: 0 }}>Select a message to read</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
