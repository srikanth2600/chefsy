'use client';

import React, { useState } from 'react';

type VideoItem = {
  title?: string;
  url?: string;
  watchUrl?: string;
  thumbnail?: string;
  channel?: string;
  id?: number;
};

export default function YouTubeEmbed({ content }: { content: { videos?: VideoItem[] } }) {
  const videos = content?.videos ?? [];
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  if (!videos.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      {videos.map((v, i) => {
        const dataVideoId = v.id ? `data-video-id-${v.id}` : undefined;
        const watchUrl = v.watchUrl || v.url || '';
        const vidMatch = watchUrl.match(/[?&]v=([^&]+)/);
        const videoId = vidMatch ? vidMatch[1] : watchUrl.split('/').pop() || '';
        const isPlaying = playingUrl === watchUrl;

        return (
          <div key={i} className="rounded-lg overflow-hidden bg-[#2e2a24]" {...(dataVideoId ? { 'data-video-id': String(v.id) } : {})}>
            {isPlaying ? (
              <div className="aspect-video bg-black">
                <iframe
                  title={v.title || 'Video'}
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPlayingUrl(watchUrl)}
                className="block w-full text-left"
              >
                {v.thumbnail && (
                  <div className="relative aspect-video">
                    <img
                      src={v.thumbnail}
                      alt={v.title || 'Video'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                        <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-2">
                  <p className="text-sm font-medium text-white truncate">{v.title}</p>
                  {v.channel && <p className="text-xs text-white/60 truncate">{v.channel}</p>}
                </div>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
