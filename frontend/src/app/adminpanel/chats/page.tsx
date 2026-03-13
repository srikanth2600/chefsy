'use client';
/**
 * Chat Logs  /adminpanel/chats
 * APIs needed:
 *   GET /admin/chats?q=&user_id=&page=&per_page=  → { chats:[{chat_id,user_id,title,message_count,created_at}], total }
 *   GET /admin/chats/:chat_id                      → { chat_id, messages:[...], user:{...} }
 *   DELETE /admin/chats/:chat_id                   → delete chat
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ModalWithFooter, ConfirmDialog, Pagination, DetailRow } from '../components/Shared';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type Chat    = { chat_id: number; user_id?: number; user_name?: string; title?: string; message_count?: number; created_at?: string; };
type Message = { role: string; content?: string; blocks?: unknown[]; created_at?: string; };

export default function ChatsPage() {
  const router = useRouter();
  const [chats,    setChats]    = useState<Chat[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [q,        setQ]        = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<{ chat: Chat; messages: Message[] } | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const perPage = 20;

  const load = useCallback(async (pg = page) => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
      if (q) p.set('q', q);
      const r = await fetch(`${API}/admin/chats?${p}`, { headers: hdr() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setChats(Array.isArray(j.chats) ? j.chats : []);
      setTotal(typeof j.total === 'number' ? j.total : 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [page, q]); // eslint-disable-line

  useEffect(() => { load(page); }, [page]); // eslint-disable-line

  const viewChat = async (chat: Chat) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`${API}/admin/chats/${chat.chat_id}`, { headers: hdr() });
      const j = r.ok ? await r.json() : { messages: [] };
      setSelected({ chat: { ...chat, ...(j.user ? { user_name: j.user.full_name } : {}) }, messages: j.messages ?? [] });
    } catch { setSelected({ chat, messages: [] }); }
    finally { setDetailLoading(false); }
  };

  const doDelete = async (id: number) => {
    await fetch(`${API}/admin/chats/${id}`, { method: 'DELETE', headers: hdr() });
    setSelected(null); load(page);
  };

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Chat Logs</div>
          <div className="adm-ph-sub">Browse all user conversations · {total} total</div>
        </div>
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error}</div>}

      <div className="adm-filters">
        <input className="adm-input" placeholder="Search by title or user…" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1))} />
        <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => { setPage(1); load(1); }}>Search</button>
        {q && <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setQ(''); setPage(1); load(1); }}>Clear</button>}
      </div>

      <div className="adm-card">
        <div className="adm-tbl-wrap">
          <table className="adm-tbl">
            <thead>
              <tr>
                <th>Chat ID</th>
                <th>Title</th>
                <th>User</th>
                <th>Messages</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(10).fill(0).map((_, i) => (
                <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div className="adm-sk" style={{ height: 13, width: j === 1 ? 180 : 80 }} /></td>)}</tr>
              )) : chats.length === 0 ? (
                <tr><td colSpan={6}><div className="adm-empty"><div className="adm-empty-icon">◻</div><div className="adm-empty-title">No chats found</div></div></td></tr>
              ) : chats.map(c => (
                <tr key={c.chat_id}>
                  <td className="adm-mono" style={{ color: 'var(--at3)' }}>#{c.chat_id}</td>
                  <td className="td-bold adm-truncate" style={{ maxWidth: 240 }}>{c.title || 'Untitled chat'}</td>
                  <td style={{ fontSize: 12 }}>{c.user_name || (c.user_id ? `User #${c.user_id}` : '—')}</td>
                  <td>
                    <span style={{ background: 'var(--abd)', color: 'var(--abl)', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                      {c.message_count ?? '?'} msgs
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                  <td>
                    <div className="adm-row adm-g2">
                      <button className="adm-btn adm-btn-info adm-btn-sm" onClick={() => viewChat(c)} disabled={detailLoading}>View</button>
                      <button className="adm-btn adm-btn-danger adm-btn-sm"
                        onClick={() => setConfirm({ msg: `Delete chat #${c.chat_id}?`, fn: () => { setConfirm(null); doDelete(c.chat_id); } })}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={total} page={page} perPage={perPage} onPage={setPage} />
      </div>

      {/* Chat detail */}
      {selected && (
        <ModalWithFooter
          title={`Chat #${selected.chat.chat_id} — ${selected.chat.title || 'Untitled'}`}
          onClose={() => setSelected(null)} wide
          footer={
            <button className="adm-btn adm-btn-danger adm-btn-sm"
              onClick={() => setConfirm({ msg: `Delete chat #${selected.chat.chat_id}?`, fn: () => { setConfirm(null); doDelete(selected.chat.chat_id); } })}>
              Delete Chat
            </button>
          }
        >
          <div style={{ marginBottom: 14 }}>
            <DetailRow label="User"     value={selected.chat.user_name || `ID ${selected.chat.user_id}`} />
            <DetailRow label="Messages" value={selected.messages.length} />
            <DetailRow label="Created"  value={selected.chat.created_at ? new Date(selected.chat.created_at).toLocaleString() : '—'} />
          </div>
          <div style={{ borderTop: '1px solid var(--ae)', paddingTop: 14, maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selected.messages.map((m, i) => (
              <div key={i} style={{
                padding: '10px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                background: m.role === 'user' ? 'var(--acd2)' : 'var(--ab2)',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%', border: '1px solid var(--ae)',
              }}>
                <div style={{ fontSize: 10, color: 'var(--at3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {m.role === 'user' ? '👤 User' : '🍳 Chef AI'}
                </div>
                <div style={{ color: 'var(--at)' }}>{m.content || '[recipe / media block]'}</div>
              </div>
            ))}
            {selected.messages.length === 0 && (
              <div style={{ color: 'var(--at3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No messages to display</div>
            )}
          </div>
        </ModalWithFooter>
      )}

      {confirm && <ConfirmDialog title="Confirm Delete" message={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} danger />}
    </>
  );
}
