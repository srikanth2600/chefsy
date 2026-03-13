 'use client';
import React, { useState } from 'react';

export default function VideoSubmit({ onSubmitted }: { onSubmitted?: (id: number)=>void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';

  const submit = async () => {
    const token = localStorage.getItem('gharka_token');
    if (!token) { alert('Please login'); return; }
    if (!url) { alert('Please enter video URL'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url, title, description }),
      });
      const j = await res.json();
      if (res.ok) {
        alert('Video submitted and pending approval');
        setUrl(''); setTitle(''); setDescription('');
        if (onSubmitted) onSubmitted(j.video_id);
      } else {
        alert('Submit failed: ' + (j.detail || res.status));
      }
    } catch (e) {
      console.error(e);
      alert('Submit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="video-submit p-3 bg-[#231f1b] rounded-md">
      <div className="mb-2 text-white font-semibold">Submit Video</div>
      <input className="w-full mb-2 p-2 rounded bg-transparent border border-white border-opacity-10 text-white" placeholder="Video URL (YouTube/Instagram)" value={url} onChange={(e)=>setUrl(e.target.value)} />
      <input className="w-full mb-2 p-2 rounded bg-transparent border border-white border-opacity-10 text-white" placeholder="Title" value={title} onChange={(e)=>setTitle(e.target.value)} />
      <textarea className="w-full mb-2 p-2 rounded bg-transparent border border-white border-opacity-10 text-white" placeholder="Description" value={description} onChange={(e)=>setDescription(e.target.value)} />
      <div className="flex justify-end">
        <button className="px-3 py-2 bg-orange-500 text-white rounded" onClick={submit} disabled={loading}>{loading ? 'Sending...' : 'Submit'}</button>
      </div>
    </div>
  );
}

