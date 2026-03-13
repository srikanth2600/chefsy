 'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Pagination from '@/app/adminpanel/components/Pagination';
import Modal from '@/app/adminpanel/components/Modal';
import ConfirmDialog from '@/app/adminpanel/components/ConfirmDialog';
import { fetchVideosApi, createVideoApi, updateVideoApi, deleteVideoApi } from './api';
import type { AdminVideo } from './types';

export default function VideosPage() {
  const router = useRouter();
  const [token] = useState<string>(() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } });
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminVideo | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const j = await fetchVideosApi(token);
      const list: AdminVideo[] = Array.isArray(j.videos) ? j.videos : (j || []);
      setVideos(list);
      setTotal(list.length);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!token) { router.push('/adminpanel/login'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (payload: any) => {
    try {
      await createVideoApi(token, payload);
      setShowCreate(false);
      await load();
    } catch (err: any) { setError(err.message || String(err)); }
  };

  const handleUpdate = async (id: number, payload: any) => {
    try {
      await updateVideoApi(token, id, payload);
      setSelected(null);
      await load();
    } catch (err: any) { setError(err.message || String(err)); }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteVideoApi(token, id);
      await load();
    } catch (err: any) { setError(err.message || String(err)); }
  };

  const paginated = (() => {
    const start = (page - 1) * perPage;
    return videos.slice(start, start + perPage);
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Videos</h2>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => setShowCreate(true)}>Add YouTube</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : null}
      {error && <div className="text-sm text-red-400 mb-2">{error}</div>}

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>URL</th>
              <th>Recipe</th>
              <th>Watch</th>
              <th>Keywords</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((v) => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>{v.title || '-'}</td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.url}</td>
                <td>{v.recipe_id ?? '-'}</td>
                <td>{v.watch_count ?? 0}</td>
                <td>{Array.isArray(v.keywords_json) ? v.keywords_json.join(', ') : (v.keywords || '-')}</td>
                <td>{v.status}</td>
                <td className="actions">
                  <button className="btn btn-view" onClick={() => setSelected(v)}>View/Edit</button>
                  <button className="btn btn-toggle" onClick={() => setConfirm({ message: `Delete video ${v.id}?`, onConfirm: async () => { setConfirm(null); await handleDelete(v.id); } })}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <div className="text-sm text-white/60">Showing {videos.length} videos</div>
        <Pagination total={total} page={page} perPage={perPage} onPage={(p) => setPage(p)} />
      </div>

      {showCreate && (
        <Modal title="Add YouTube video" onClose={() => setShowCreate(false)}>
          <CreateVideoForm onCreate={handleCreate} onCancel={() => setShowCreate(false)} />
        </Modal>
      )}

      {selected && (
        <Modal title={`Video ${selected.id}`} onClose={() => setSelected(null)}>
          <EditVideoForm video={selected} onSave={(payload) => handleUpdate(selected.id, payload)} onCancel={() => setSelected(null)} />
        </Modal>
      )}

      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function CreateVideoForm({ onCreate, onCancel }: { onCreate: (p: any) => Promise<void>; onCancel: () => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [channel, setChannel] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const payload = { url, title, category, keywords: keywords.split(',').map(s => s.trim()).filter(Boolean), thumbnail, channel };
      await onCreate(payload);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <label className="text-xs">YouTube URL</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={url} onChange={(e) => setUrl(e.target.value)} />
      <label className="text-xs">Title</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="text-xs">Category</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={category} onChange={(e) => setCategory(e.target.value)} />
      <label className="text-xs">Keywords (comma separated)</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      <label className="text-xs">Thumbnail URL</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} />
      <label className="text-xs">Channel</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={channel} onChange={(e) => setChannel(e.target.value)} />
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'Adding...' : 'Add video'}</button>
      </div>
    </div>
  );
}

function EditVideoForm({ video, onSave, onCancel }: { video: AdminVideo; onSave: (p: any) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState(video.title || '');
  const [category, setCategory] = useState(video.category || '');
  const [keywords, setKeywords] = useState(Array.isArray(video.keywords_json) ? video.keywords_json.join(', ') : (video.keywords || ''));
  const [watchCount, setWatchCount] = useState<number>(video.watch_count || 0);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const payload: any = { title, category, keywords: keywords.split(',').map(s => s.trim()).filter(Boolean), watch_count: watchCount };
      await onSave(payload);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div><strong>URL:</strong> <div className="truncate">{video.url}</div></div>
      <label className="text-xs">Title</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="text-xs">Category</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={category} onChange={(e) => setCategory(e.target.value)} />
      <label className="text-xs">Keywords (comma separated)</label>
      <input className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      <label className="text-xs">Watch count</label>
      <input type="number" className="w-full px-3 py-2 rounded bg-[#0f0e0c]" value={watchCount} onChange={(e) => setWatchCount(Number(e.target.value))} />
      <div className="flex gap-2 justify-end">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
}

