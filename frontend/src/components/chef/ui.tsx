'use client';

import React from 'react';
import { useChefTheme } from './ChefThemeContext';
import type { ThemeTokens } from './ChefThemeContext';

// ─── Avatar ───────────────────────────────────────────────────────────────────
interface AvatarProps {
  name: string;
  color: string;
  imageUrl?: string;
  size?: number;
  radius?: number;
  verified?: boolean;
  verifiedColor?: string;
  verifiedBorder?: string;
}
export function Avatar({ name, color, imageUrl, size = 40, radius = 10, verified, verifiedColor, verifiedBorder }: AvatarProps) {
  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{ position: 'relative', flexShrink: 0, display: 'inline-flex' }}>
      <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: imageUrl ? `url(${imageUrl}) center/cover` : color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.33, fontWeight: 700, color: '#fff',
        overflow: 'hidden',
      }}>
        {!imageUrl && initials}
      </div>
      {verified && (
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          width: Math.max(12, size * 0.28), height: Math.max(12, size * 0.28),
          borderRadius: '50%', background: verifiedColor || '#DA7756',
          border: `2px solid ${verifiedBorder || '#0F0D0A'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.max(7, size * 0.15), color: '#fff', fontWeight: 800,
        }}>✓</div>
      )}
    </div>
  );
}

// ─── Pill/Tag ─────────────────────────────────────────────────────────────────
interface PillProps {
  children: React.ReactNode;
  accent?: boolean;
  small?: boolean;
  t: ThemeTokens;
}
export function Pill({ children, accent, small, t }: PillProps) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: small ? 8 : 10,
      padding: small ? '1px 6px' : '2px 9px',
      borderRadius: 99,
      background: accent ? t.accentBg : t.bgSurface,
      border: `1px solid ${accent ? t.borderAcc : t.border}`,
      color: accent ? t.accent : t.textSecondary,
      whiteSpace: 'nowrap',
      lineHeight: 1.6,
    }}>
      {children}
    </span>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  t: ThemeTokens;
}
export function Btn({ children, variant = 'primary', size = 'md', t, style, ...rest }: BtnProps) {
  const pad = size === 'sm' ? '5px 12px' : size === 'lg' ? '12px 24px' : '8px 18px';
  const fs = size === 'sm' ? 11 : size === 'lg' ? 14 : 12;
  const bg = variant === 'primary'
    ? `linear-gradient(135deg,${t.accent},${t.accentHov})`
    : variant === 'danger'
    ? `linear-gradient(135deg,${t.error},#b03030)`
    : 'transparent';
  const border = variant === 'ghost' ? `1px solid ${t.border}` : 'none';
  const color = variant === 'primary' || variant === 'danger' ? '#fff' : t.textSecondary;
  return (
    <button style={{
      padding: pad, borderRadius: 10, border, background: bg,
      color, fontSize: fs, fontWeight: 600, cursor: rest.disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', opacity: rest.disabled ? 0.5 : 1,
      transition: 'opacity 0.15s',
      ...style,
    }} {...rest}>
      {children}
    </button>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────
export function SLabel({ children, t }: { children: React.ReactNode; t: ThemeTokens }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: t.textTertiary,
      textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px',
    }}>
      {children}
    </p>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, t, style }: { children: React.ReactNode; t: ThemeTokens; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: t.bgCard, border: `1px solid ${t.border}`,
      borderRadius: 14, padding: '14px', ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  t: ThemeTokens;
}
export function Input({ t, style, ...rest }: InputProps) {
  return (
    <input style={{
      width: '100%', padding: '8px 12px', borderRadius: 10,
      border: `1px solid ${t.border}`, background: t.bgInput,
      color: t.textPrimary, fontSize: 13, fontFamily: 'inherit',
      outline: 'none', boxSizing: 'border-box',
      ...style,
    }} {...rest} />
  );
}

// ─── Theme Toggle Button ──────────────────────────────────────────────────────
export function ThemeToggle() {
  const { isDark, toggle, t } = useChefTheme();
  return (
    <button onClick={toggle} title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.border}`,
        background: t.bgCard, cursor: 'pointer', fontSize: 17,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.textSecondary, flexShrink: 0,
      }}>
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}

// ─── Video Reel Card (9:16) ───────────────────────────────────────────────────
interface VideoCardProps {
  title: string;
  views?: string;
  duration?: string;
  chefColor: string;
  onPlay: () => void;
  t: ThemeTokens;
}
export function VideoReelCard({ title, views, duration, chefColor, onPlay, t }: VideoCardProps) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onClick={onPlay}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', aspectRatio: '9/16',
        background: `linear-gradient(135deg,${chefColor}22,${t.bgCard})`,
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 22, opacity: 0.1,
      }}>🎬</div>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: hov ? 'translate(-50%,-50%) scale(1.12)' : 'translate(-50%,-50%)',
        width: 38, height: 38, borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.35)',
        transition: 'transform 0.2s',
      }}>
        <span style={{ fontSize: 13, marginLeft: 2 }}>▶</span>
      </div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '18px 6px 6px',
        background: 'linear-gradient(transparent,rgba(0,0,0,0.78))',
      }}>
        <p style={{
          fontSize: 9, color: '#F5EFE6', margin: '0 0 3px', fontWeight: 600,
          opacity: hov ? 1 : 0, transition: 'opacity 0.2s', lineHeight: 1.3,
        }}>{title}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {views && <span style={{ fontSize: 8, background: 'rgba(0,0,0,0.6)', color: '#BCA98D', padding: '1px 5px', borderRadius: 4 }}>{views}</span>}
          {duration && <span style={{ fontSize: 8, background: 'rgba(0,0,0,0.6)', color: '#F5EFE6', padding: '1px 5px', borderRadius: 4 }}>{duration}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────
export function Stars({ rating }: { rating: number | null }) {
  const full = Math.floor(rating ?? 0);
  return (
    <span style={{ color: '#F59E0B', fontSize: 10, letterSpacing: 1 }}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
    </span>
  );
}

// ─── Format number ────────────────────────────────────────────────────────────
export function fmtN(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}
