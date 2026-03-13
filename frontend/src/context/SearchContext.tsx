'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

const SearchContext = createContext<any>(null);

export const SearchProvider = ({ children }: { children: React.ReactNode }) => {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [chatId, setChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Array<{ role: 'user'; content: string } | { role: 'assistant'; recipe: Record<string, unknown> }>>([]);
  const [lastMode, setLastMode] = useState<'Text' | 'Image' | 'Video'>('Text');
  const [recentChats, setRecentChats] = useState<{ chat_id: number; title: string }[]>([]);
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmailDisplay, setUserEmailDisplay] = useState<string | null>(null);

  const getToken = () => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem('gharka_token');
    } catch {
      return null;
    }
  };

  useEffect(() => {
    try {
      const token = localStorage.getItem('gharka_token');
      if (!token) {
        const name = localStorage.getItem('gharka_user_name');
        const email = localStorage.getItem('gharka_user_email');
        if (name) setUserName(name);
        if (email) setUserEmailDisplay(email);
        return;
      }
      fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          if (!res.ok) throw new Error('No profile');
          return res.json();
        })
        .then((json) => {
          if (json?.full_name) {
            setUserName(json.full_name);
            try {
              localStorage.setItem('gharka_user_name', json.full_name);
            } catch {}
          }
          if (json?.email) {
            setUserEmailDisplay(json.email);
            try {
              localStorage.setItem('gharka_user_email', json.email);
            } catch {}
          }
        })
        .catch(() => {
          const name = localStorage.getItem('gharka_user_name');
          const email = localStorage.getItem('gharka_user_email');
          if (name) setUserName(name);
          if (email) setUserEmailDisplay(email);
        });
    } catch {}
  }, [apiBase]);

  const fetchChats = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/chats`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const j = await res.json();
      setRecentChats(Array.isArray(j?.chats) ? j.chats : []);
    } catch {}
  };

  useEffect(() => {
    if (getToken()) fetchChats();
  }, [apiBase]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/providers`);
        if (!res.ok) return;
        const j = await res.json();
        if (Array.isArray(j?.providers)) {
          setProviders(j.providers);
          setSelectedProvider(j.default || (j.providers[0] && j.providers[0].id));
        }
      } catch {}
    })();
  }, [apiBase]);


  const sendMessage = async (text?: string, mode?: 'Text' | 'Image' | 'Video', module?: string) => {
    const token = getToken();
    if (!token) {
      // consumer should handle auth UI
      return { error: 'auth_required' };
    }
    const trimmed = (text ?? message).trim();
    const requestedMode = mode ?? 'Text';
    setLastMode(requestedMode);
    if (!trimmed || loading) return;
    if (text) setMessage(text);
    setLoading(true);
    setError(null);
    try {
      // If no chat session exists yet, create one immediately so UI gets chatId before generation.
      let currentChatId = chatId;
      if (!currentChatId) {
        try {
          console.log('sendMessage: creating chat session');
          const sessionRes = await fetch(`${apiBase}/chat_sessions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          if (!sessionRes.ok) {
            console.error('create chat session failed', sessionRes.status, await sessionRes.text());
          } else {
            const sj = await sessionRes.json();
            currentChatId = sj?.chat_id ?? null;
            console.log('sendMessage: created session', currentChatId);
            setChatId(currentChatId);
            // refresh recent chats
            try { await fetchChats(); } catch (e) { console.warn('fetchChats failed', e); }
          }
        } catch (err) {
          console.error('sendMessage: create session threw', err);
          // fallback: continue and let /chat create session server-side
        }
      }
      if (requestedMode === 'Video') {
        const url = `${apiBase}/youtube?title=${encodeURIComponent(trimmed)}&limit=2`;
        const resV = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!resV.ok) throw new Error(`YouTube lookup failed ${resV.status}`);
        const jv = await resV.json();
        setData(null);
        setLoading(false);
        return { videos: Array.isArray(jv) ? jv.slice(0, 2) : [] };
      }

      const moduleQuery = module ?? selectedProvider;
      const url = `${apiBase}/chat${moduleQuery ? `?module=${encodeURIComponent(moduleQuery)}` : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chat_id: currentChatId ?? null, message: trimmed, include_videos: false }),
      });
      if (!res.ok) {
        setError('Request failed');
        throw new Error(`Request failed ${res.status}`);
      }
      // Apply 60s timeout only when backend indicates LLM generation (cached responses have no header → never aborted)
      const isLLM = res.headers.get('x-llm-generation') === 'true';
      type ChatApiResponse = { chat_id: number; messages: Array<{ role: 'user'; content: string } | { role: 'assistant'; recipe: Record<string, unknown> }> };
      let json: ChatApiResponse;
      if (isLLM) {
        // For Ollama: /chat returns immediately with placeholder assistant message in DB
        json = await res.json();
        setChatId(json.chat_id);
        setMessages(json.messages);
        fetchChats();
        return { chat_id: json.chat_id, messages: json.messages };
      } else {
        json = await res.json();
      }
      const wasNewChat = chatId === null;
      setChatId(json.chat_id);
      if (wasNewChat) {
        setMessages(json.messages);
      } else {
        setMessages((prev) => [...prev, ...json.messages.slice(prev.length)]);
      }
      const lastMsg = json.messages[json.messages.length - 1];
      const lastRecipe = lastMsg && lastMsg.role === 'assistant' ? lastMsg.recipe : null;
      setData(lastRecipe);
      fetchChats();
      return { chat_id: json.chat_id, messages: json.messages };
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Try refreshing recent chats so a server-created chat/session is visible
      try {
        await fetchChats();
      } catch {}
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loadChat = async (id: number) => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${apiBase}/chat/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const j = await res.json();
      setChatId(j.chat_id);
      setMessages(j.messages ?? []);
    } catch {}
  };

  return (
    <SearchContext.Provider
      value={{
        message,
        setMessage,
        loading,
        error,
        data,
        chatId,
        setChatId,
        messages,
        setMessages,
        lastMode,
        setLastMode,
        recentChats,
        fetchChats,
        loadChat,
        providers,
        selectedProvider,
        setSelectedProvider,
        sendMessage,
        // Expose createChatSession so UI can call it explicitly on "New chat" clicks
        createChatSession: async () => {
          const token = getToken();
          console.log('createChatSession: token present?', !!token);
          if (!token) {
            console.warn('createChatSession: no token available');
            return null;
          }
          try {
            console.log('createChatSession: sending POST /chat_sessions');
            const res = await fetch(`${apiBase}/chat_sessions`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) {
              console.error('createChatSession failed', res.status, await res.text());
              return null;
            }
            const j = await res.json();
            setChatId(j.chat_id ?? null);
            try { await fetchChats(); } catch {}
            return j.chat_id ?? null;
          } catch (err) {
            console.error('createChatSession error', err);
            return null;
          }
        },
        userName,
        userEmailDisplay,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used inside SearchProvider');
  return ctx;
};

