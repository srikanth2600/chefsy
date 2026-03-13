'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useSearch } from '@/context/SearchContext';
import { usePathname } from 'next/navigation';

export default function SearchBarNew(props: {
  value?: string;
  onChange?: (v: string) => void;
  onSubmit?: (text?: string, mode?: 'Text' | 'Video', module?: string) => void;
  loading?: boolean;
  providers?: { id: string; label: string }[];
  selectedProvider?: string | null;
  onProviderChange?: (p: string) => void;
}) {
  const ctx = useSearch();
  const pathname = usePathname();

  const value            = props.value            ?? ctx.message          ?? '';
  const onChange         = props.onChange          ?? ctx.setMessage;
  const onSubmit         = props.onSubmit          ?? ctx.sendMessage;
  const loading          = props.loading           ?? ctx.loading;
  const providers        = props.providers         ?? ctx.providers;
  const selectedProvider = props.selectedProvider  ?? ctx.selectedProvider;
  const onProviderChange = props.onProviderChange  ?? ctx.setSelectedProvider;

  const [chatMode, setChatMode]       = useState<'Text' | 'Video'>('Text');
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused]     = useState(false);

  const textareaRef        = useRef<HTMLTextAreaElement>(null);
  const recognitionRef     = useRef<any>(null);
  const mediaStreamRef     = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef<string>('');

  const isSubmitAllowed = Boolean(value.trim()) && !loading;

  /* ── Auto-resize textarea ── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [value]);

  /* ── Voice helpers ── */
  const startListening = async () => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported in this browser.'); return; }
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          alert('Microphone permission denied. Please enable it and try again.');
          return;
        }
      }
      if (!recognitionRef.current) {
        const r = new SR();
        r.lang = 'en-US';
        r.interimResults = true;
        r.continuous = true;
        r.onstart = () => setIsListening(true);
        r.onend   = () => setIsListening(false);
        r.onerror = (e: any) => { if (e?.error !== 'no-speech') console.warn(e); setIsListening(false); };
        r.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) finalTranscriptRef.current += t;
            else interim += t;
          }
          const display = (finalTranscriptRef.current + ' ' + interim).trim();
          if (display) onChange(display);
        };
        recognitionRef.current = r;
      }
      finalTranscriptRef.current = '';
      try { recognitionRef.current.start(); } catch {}
    } catch {}
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch {}
    try {
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    } catch {}
    setIsListening(false);
  };

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch {}
    try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
  }, []);

  /* ── Submit ── */
  const handleSubmit = () => {
    if (isSubmitAllowed) {
      onSubmit?.(value, chatMode, chatMode === 'Text' ? selectedProvider ?? undefined : undefined);
    }
  };
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const showProviders = chatMode === 'Text'
    && (!pathname || pathname === '/' || pathname.startsWith('/instructions'))
    && providers && providers.length > 0;

  return (
    <div
      className="gk-searchbar"
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${isFocused ? 'var(--accent-alpha-30)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        transition: 'border-color var(--transition), box-shadow var(--transition)',
        boxShadow: isFocused ? 'var(--glow-accent)' : 'var(--shadow-sm)',
      }}
    >
      {/* Textarea row */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        rows={1}
        placeholder="Ask for a recipe, ingredients, or cooking tips…"
        style={{
          width: '100%',
          resize: 'none',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontSize: '14px',
          lineHeight: '1.6',
          outline: 'none',
          padding: '14px 16px 8px',
          minHeight: '52px',
          maxHeight: '140px',
          fontFamily: 'inherit',
          border: 'none',
          display: 'block',
        }}
        className="gk-textarea-placeholder"
      />

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px 10px',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Mode toggle + provider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
          {/* Text / Video toggle */}
          <div
            style={{
              display: 'flex',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {(['Text', 'Video'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setChatMode(m)}
                style={{
                  padding: '5px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background var(--transition), color var(--transition)',
                  background: chatMode === m
                    ? 'linear-gradient(135deg, var(--claude-orange), #C45E3A)'
                    : 'transparent',
                  color: chatMode === m ? '#fff' : 'var(--text-secondary)',
                  letterSpacing: '0.02em',
                }}
              >
                {m === 'Text' ? '💬 Text' : '▶ Video'}
              </button>
            ))}
          </div>

          {/* Provider dropdown */}
          {showProviders && (
            <select
              value={selectedProvider ?? ''}
              onChange={e => onProviderChange?.(e.target.value)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                fontFamily: 'inherit',
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '130px',
                transition: 'border-color var(--transition)',
              }}
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Mic + Send */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Mic */}
          <button
            type="button"
            onClick={() => isListening ? stopListening() : startListening()}
            title={isListening ? 'Stop listening' : 'Voice input'}
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isListening ? 'rgba(239,68,68,0.15)' : 'var(--bg-elevated)',
              color: isListening ? '#ef4444' : 'var(--text-tertiary)',
              transition: 'all var(--transition)',
              flexShrink: 0,
            }}
          >
            {isListening ? (
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" className="animate-pulse" />
              </svg>
            ) : (
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 014 4v7a4 4 0 01-8 0V5a4 4 0 014-4zm-6.5 11a6.5 6.5 0 0013 0H20a8 8 0 01-16 0h1.5zM11 22h2v2h-2z"/>
              </svg>
            )}
          </button>

          {/* Send */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isSubmitAllowed}
            style={{
              height: 34,
              padding: '0 18px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: isSubmitAllowed ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'inherit',
              color: isSubmitAllowed ? '#fff' : 'var(--accent)',
              background: isSubmitAllowed
                ? 'linear-gradient(135deg, var(--claude-orange), #C45E3A)'
                : 'var(--accent-alpha-15)',
              opacity: isSubmitAllowed ? 1 : 0.65,
              transition: 'opacity var(--transition), transform var(--transition)',
              flexShrink: 0,
            }}
          >
            {loading ? (
              <>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"/>
                </svg>
                Cooking…
              </>
            ) : (
              <>
                Ask Chef
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .gk-textarea-placeholder::placeholder { color: var(--text-tertiary); }
      `}</style>
    </div>
  );
}
