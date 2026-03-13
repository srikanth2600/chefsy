 'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = { id: number; full_name: string; email: string; phone?: string; user_type?: string; is_verified?: boolean; is_admin?: boolean; created_at?: string; };
type Recipe = { id: number; recipe_key: string; title: string; servings?: number; created_at?: string; updated_at?: string; };
type Video = { id: number; user_id: number; recipe_id?: number; url: string; title?: string; status?: string; created_at?: string; };

export default function AdminPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
  const router = useRouter();
  const [adminToken, setAdminToken] = useState<string>(() => {
    try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; }
  });
  const [users, setUsers] = useState<User[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard'|'users'|'recipes'|'videos'|'admin-mgmt'>('dashboard');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 8;
  const [detailItem, setDetailItem] = useState<any | null>(null);

  const getAuthHeader = (token?: string) => {
    const t = token ?? adminToken;
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const fetchUsers = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/users`, { headers: { ...getAuthHeader() } });
      if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
      const j = await res.json();
      setUsers(Array.isArray(j.users) ? j.users : []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally { setLoading(false); }
  };

  const fetchRecipes = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/recipes`, { headers: { ...getAuthHeader() } });
      if (!res.ok) throw new Error(`Failed to fetch recipes (${res.status})`);
      const j = await res.json();
      setRecipes(Array.isArray(j.recipes) ? j.recipes : []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally { setLoading(false); }
  };

  const fetchVideos = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/videos`, { headers: { ...getAuthHeader() } });
      if (!res.ok) throw new Error(`Failed to fetch videos (${res.status})`);
      const j = await res.json();
      setVideos(Array.isArray(j.videos) ? j.videos : []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally { setLoading(false); }
  };

  const fetchAdmins = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/admins`, { headers: { ...getAuthHeader() } });
      if (!res.ok) throw new Error(`Failed to fetch admins (${res.status})`);
      const j = await res.json();
      setAdmins(Array.isArray(j.admins) ? j.admins : []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!adminToken) {
      router.push('/admin/login');
      return;
    }
    (async () => {
      try {
        const meRes = await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${adminToken}` } });
        if (!meRes.ok) {
          try { localStorage.removeItem('gharka_token'); } catch {}
          router.push('/admin/login');
          return;
        }
        const me = await meRes.json();
        if (!me || !me.is_admin) {
          try { localStorage.removeItem('gharka_token'); } catch {}
          router.push('/admin/login');
          return;
        }
        await Promise.all([fetchUsers(), fetchRecipes(), fetchVideos(), fetchAdmins()]);
      } catch {
        try { localStorage.removeItem('gharka_token'); } catch {}
        router.push('/admin/login');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  const handleSetToken = () => {
    try { localStorage.setItem('gharka_token', adminToken); } catch {}
    setAdminToken((t) => t);
  };

  const doAction = async (method: string, path: string, body?: any) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${apiBase}${path}`, { method, headers: { 'Content-Type': 'application/json', ...getAuthHeader() }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Action failed (${res.status}): ${txt}`);
      }
      await Promise.all([fetchUsers(), fetchRecipes(), fetchVideos(), fetchAdmins()]);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally { setLoading(false); }
  };

  // Helpers: filtered + paginated
  const paginate = (items: any[]) => {
    const filtered = items.filter((it) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return JSON.stringify(it).toLowerCase().includes(s);
    });
    const total = filtered.length;
    const start = (page - 1) * perPage;
    return { items: filtered.slice(start, start + perPage), total };
  };
  return (
    <div className="h-screen flex bg-[#0b0a08]">
      {/* Left sidebar */}
      <aside className="w-64 p-6 bg-[#0f0e0c] border-r border-white/6 flex flex-col">
        <div className="mb-6 flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-10 w-10 object-contain" />
          <div>
            <h2 className="text-white font-bold">Chefsy</h2>
            <p className="text-xs text-white/40">Admin panel</p>
          </div>
        </div>

        <div className="mb-4">
          <input value={adminToken} onChange={(e) => setAdminToken(e.target.value)} placeholder="Admin token" className="w-full px-3 py-2 rounded bg-[#161310] text-sm" />
          <button className="mt-2 w-full px-3 py-2 bg-orange-500 rounded text-white" onClick={handleSetToken}>Save token</button>
        </div>

        <nav className="flex-1">
          <ul className="space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'users', label: 'User Management' },
              { id: 'recipes', label: 'Recipes' },
              { id: 'videos', label: 'Videos' },
              { id: 'admin-mgmt', label: 'Admin Management' },
            ].map((t) => (
              <li key={t.id}>
                <button onClick={() => { setActiveTab(t.id as any); setPage(1); }} className={`w-full text-left px-3 py-2 rounded ${activeTab === (t.id as any) ? 'bg-orange-500 text-white' : 'text-white/70 hover:bg-white/5'}`}>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-4">
          <button className="w-full px-3 py-2 bg-red-600 rounded text-white" onClick={() => { try { localStorage.removeItem('gharka_token'); } catch {} ; router.push('/'); }}>Logout</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'users' ? 'User Management' : activeTab === 'recipes' ? 'Recipes' : activeTab === 'videos' ? 'Videos' : 'Admin Management'}</h1>
          <div className="text-sm text-white/60">Signed in as admin</div>
        </header>

        <div className="mb-4 flex items-center gap-4">
          <input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="px-3 py-2 rounded bg-[#161310] w-full max-w-lg" />
          <div className="text-sm text-white/60">Results per page: {perPage}</div>
        </div>

        {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

        {/* Content area (same as before) */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#231f1b] rounded">
              <h3 className="font-semibold mb-2">Summary</h3>
              <p className="text-sm">Users: {users.length}</p>
              <p className="text-sm">Recipes: {recipes.length}</p>
              <p className="text-sm">Videos: {videos.length}</p>
              <p className="text-sm">Admins: {admins.length}</p>
            </div>
            <div className="p-4 bg-[#231f1b] rounded md:col-span-2">
              <h3 className="font-semibold mb-2">Recent activity</h3>
              <p className="text-sm text-white/40">Use the tabs to manage users, recipes and videos.</p>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="text-lg font-semibold mb-3 text-white">User Management</h2>
            {loading ? <p>Loading...</p> : null}
            <div className="space-y-2">
              {paginate(users).items.map((u) => (
                <div key={u.id} className="p-3 bg-[#161310] rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{u.full_name} {u.is_verified ? '' : '(inactive)'}</div>
                    <div className="text-xs text-white/40">{u.email} {u.phone ? `· ${u.phone}` : ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 bg-blue-600 rounded text-xs" onClick={() => setDetailItem({ type: 'user', data: u })}>View</button>
                    <button className="px-2 py-1 bg-yellow-600 rounded text-xs" onClick={() => doAction('POST', `/admin/users/${u.id}/block`)}>{u.is_verified ? 'Deactivate' : 'Activate'}</button>
                    <button className="px-2 py-1 bg-red-600 rounded text-xs" onClick={() => doAction('DELETE', `/admin/users/${u.id}`)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination total={paginate(users).total} page={page} perPage={perPage} onPage={(p) => setPage(p)} />
          </div>
        )}

        {activeTab === 'recipes' && (
          <div>
            <h2 className="text-lg font-semibold mb-3 text-white">Recipes</h2>
            <div className="space-y-2">
              {paginate(recipes).items.map((r) => (
                <div key={r.id} className="p-3 bg-[#161310] rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{r.title}</div>
                    <div className="text-xs text-white/40">{r.recipe_key} · {r.created_at}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 bg-blue-600 rounded text-xs" onClick={() => setDetailItem({ type: 'recipe', data: r })}>View</button>
                    <button className="px-2 py-1 bg-red-600 rounded text-xs" onClick={() => doAction('POST', `/admin/recipes/${r.id}/delete`)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination total={paginate(recipes).total} page={page} perPage={perPage} onPage={(p) => setPage(p)} />
          </div>
        )}

        {activeTab === 'videos' && (
          <div>
            <h2 className="text-lg font-semibold mb-3 text-white">Videos</h2>
            <div className="space-y-2">
              {paginate(videos).items.map((v) => (
                <div key={v.id} className="p-3 bg-[#161310] rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{v.title || v.url}</div>
                    <div className="text-xs text-white/40">By user {v.user_id} · {v.status}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 bg-blue-600 rounded text-xs" onClick={() => setDetailItem({ type: 'video', data: v })}>View</button>
                    <button className="px-2 py-1 bg-green-600 rounded text-xs" onClick={() => doAction('POST', `/admin/videos/${v.id}/approve`)}>Approve</button>
                    <button className="px-2 py-1 bg-red-600 rounded text-xs" onClick={() => doAction('POST', `/admin/videos/${v.id}/reject`)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination total={paginate(videos).total} page={page} perPage={perPage} onPage={(p) => setPage(p)} />
          </div>
        )}

        {activeTab === 'admin-mgmt' && (
          <div>
            <h2 className="text-lg font-semibold mb-3 text-white">Admin Management</h2>
            <div className="space-y-2">
              {paginate(admins).items.map((a) => (
                <div key={a.id} className="p-3 bg-[#161310] rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{a.full_name}</div>
                    <div className="text-xs text-white/40">{a.email} · {a.designation}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 bg-blue-600 rounded text-xs" onClick={() => setDetailItem({ type: 'admin', data: a })}>View</button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination total={paginate(admins).total} page={page} perPage={perPage} onPage={(p) => setPage(p)} />
          </div>
        )}
      </main>
    </div>
  );
} 

function Pagination({ total, page, perPage, onPage }: { total: number; page: number; perPage: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-white/60">Showing page {page} of {pages} — {total} items</div>
      <div className="flex gap-2">
        <button className="px-2 py-1 bg-[#231f1b] rounded" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>Prev</button>
        <button className="px-2 py-1 bg-[#231f1b] rounded" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>Next</button>
      </div>
    </div>
  );

}