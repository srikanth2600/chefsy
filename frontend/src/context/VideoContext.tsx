'use client';
import React, { createContext, useContext, useState } from 'react';

const VideoContext = createContext<any>(null);

export const VideoProvider = ({ children }: { children: React.ReactNode }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<Array<{ id?: string; url: string; title?: string }>>([]);

  return (
    <VideoContext.Provider value={{ playingId, setPlayingId, playlist, setPlaylist }}>
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useVideo must be used inside VideoProvider');
  return ctx;
};

