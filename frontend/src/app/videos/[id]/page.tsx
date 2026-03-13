 'use client';
 import React, { useEffect, useState } from 'react';
 import { useRouter } from 'next/navigation';

export default function VideoByIdPage({ params }: { params?: { id?: string } }) {
  const router = useRouter();
  // support receiving params from Next or fallback to pathname
  let id: string | null = null;
  if (params && params.id) id = params.id;
  if (!id && typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    id = parts.length ? parts[parts.length - 1] : null;
  }
   const [video, setVideo] = useState<any | null>(null);
   const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) {
        setVideo(null);
        setLoading(false);
        return;
      }
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';
        const res = await fetch(`${apiBase}/videos/${encodeURIComponent(id)}`);
        if (!res.ok) {
          setVideo(null);
          setLoading(false);
          return;
        }
        const j = await res.json();
        setVideo(j);
      } catch (e) {
        setVideo(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

   if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
   if (!video) return <div className="min-h-screen flex items-center justify-center text-white">Video not found.</div>;

   // extract id from video.url
   const url: string = video.url || '';
   const m = url.match(/[?&]v=([^&]+)/);
   const vid = m ? m[1] : url.split('/').pop() || '';

   return (
     <div className="min-h-screen flex flex-col items-center justify-start py-8" style={{ backgroundColor: '#1a1815' }}>
       <div className="w-full max-w-md px-4">
         <div className="bg-[#2e2a24] rounded-lg p-4">
           <div style={{ width: 280 }}>
             <div style={{ position: 'relative', paddingTop: `${(9 / 16) * 100}%` }}>
               <iframe
                 src={`https://www.youtube.com/embed/${vid}?autoplay=1`}
                 title={video.title || 'Video'}
                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                 allowFullScreen
                 style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 8 }}
               />
             </div>
           </div>

           <div className="mt-3">
             <div className="text-white font-semibold">{video.title || 'Video'}</div>
             <div className="mt-2 flex items-center gap-3">
               <button className="px-3 py-1 rounded bg-[#3b3b3b] text-white" onClick={() => router.back()}>
                 Back
               </button>
             </div>
           </div>
         </div>
       </div>
     </div>
   );
 }

