'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Design Tokens ────────────────────────────────────────────────────────────

export const darkTheme = {
  bg:         '#0F0D0A',
  bgElevated: '#1C1813',
  bgSurface:  '#211A13',
  bgCard:     '#2A2319',
  bgInput:    'rgba(255,255,255,0.05)',
  border:     'rgba(212,184,150,0.10)',
  borderAcc:  'rgba(218,119,86,0.30)',
  textPrimary:   '#F5EFE6',
  textSecondary: '#BCA98D',
  textTertiary:  '#7D6A52',
  accent:     '#DA7756',
  accentHov:  '#C45E3A',
  accentBg:   'rgba(218,119,86,0.15)',
  success:    '#5CB87E',
  warning:    '#E8B84B',
  error:      '#E06B6B',
  overlay:    'rgba(0,0,0,0.82)',
};

export const lightTheme = {
  bg:         '#FAF8F5',
  bgElevated: '#F2EDE6',
  bgSurface:  '#EDE5D8',
  bgCard:     '#E8DFD0',
  bgInput:    'rgba(0,0,0,0.04)',
  border:     'rgba(100,70,40,0.12)',
  borderAcc:  'rgba(180,80,40,0.30)',
  textPrimary:   '#1A1208',
  textSecondary: '#5C3D1E',
  textTertiary:  '#9A7A5A',
  accent:     '#C45E3A',
  accentHov:  '#A84D2E',
  accentBg:   'rgba(196,94,58,0.10)',
  success:    '#3A8C5C',
  warning:    '#B87A10',
  error:      '#C04040',
  overlay:    'rgba(0,0,0,0.55)',
};

export type ThemeTokens = typeof darkTheme;

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeCtx {
  isDark: boolean;
  toggle: () => void;
  t: ThemeTokens;
}

const ThemeContext = createContext<ThemeCtx>({
  isDark: true,
  toggle: () => {},
  t: darkTheme,
});

export function ChefThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  // Persist preference
  useEffect(() => {
    const stored = localStorage.getItem('gk-chef-theme');
    if (stored === 'light') setIsDark(false);
  }, []);

  const toggle = () => {
    setIsDark((v) => {
      const next = !v;
      localStorage.setItem('gk-chef-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggle, t: isDark ? darkTheme : lightTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useChefTheme = () => useContext(ThemeContext);
