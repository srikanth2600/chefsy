 'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Pagination from '@/app/adminpanel/components/Pagination';
import Modal from '@/app/adminpanel/components/Modal';
import ConfirmDialog from '@/app/adminpanel/components/ConfirmDialog';
import { fetchUsersApi } from './api';
import type { AdminUser } from './types';

export default function UsersPage() {
  const router = useRouter();
  const [token, setToken] = useState<string>(() => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const j = await fetchUsersApi(token, q || null, page, perPage);
      // expected shape: { users: [...], total: N } - backend may differ
      setUsers(Array.isArray(j.users) ? j.users : []);
      setTotal(typeof j.total === 'number' ? j.total : (Array.isArray(j.users) ? j.users.length : 0));
    } catch (err: any) {
      setError(err.message || String(err));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!token) { router.push('/admin/login'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="flex gap-2 items-center">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email..." className="search-input" />
          <button className="btn-primary" onClick={() => { setPage(1); load(); }}>Search</button>
          <button className="btn-ghost" onClick={() => { try { localStorage.removeItem('gharka_token'); } catch {} ; router.push('/adminpanel/login'); }}>Logout</button>
        </div>
      </div>

      {loading ? <div>Loading...</div> : null}
      {error && <div className="text-sm text-red-400 mb-2">{error}</div>}

      <div className="overflow-auto admin-card rounded">
        <table className="min-w-full text-left admin-table">
          <thead>
            <tr className="text-sm text-white/60">
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/6">
                <td className="px-4 py-3 text-sm">{u.id}</td>
                <td className="px-4 py-3 text-sm">{u.full_name}</td>
                <td className="px-4 py-3 text-sm">{u.email}</td>
                <td className="px-4 py-3 text-sm">{u.phone || '-'}</td>
                <td className="px-4 py-3 text-sm">{u.user_type || '-'}</td>
                <td className="px-4 py-3 text-sm">{u.is_verified ? 'Active' : 'Inactive'}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 bg-blue-600 rounded text-xs" onClick={() => setSelected(u)}>View</button>
                    <button className="px-2 py-1 bg-yellow-600 rounded text-xs" onClick={() => setConfirm({ message: `Toggle active for ${u.full_name}?`, onConfirm: async () => { setConfirm(null); try { await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005'}/admin/users/${u.id}/block`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); await load(); } catch {} } })}>{u.is_verified ? 'Deactivate' : 'Activate'}</button>
                    <button className="px-2 py-1 bg-red-600 rounded text-xs" onClick={() => setConfirm({ message: `Delete ${u.full_name}?`, onConfirm: async () => { setConfirm(null); try { await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005'}/admin/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); await load(); } catch {} } })}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={total} page={page} perPage={perPage} onPage={(p) => setPage(p)} />

      {selected && <Modal title={`User: ${selected.full_name}`} onClose={() => setSelected(null)}>
        <div className="space-y-2">
          <div><strong>ID:</strong> {selected.id}</div>
          <div><strong>Email:</strong> {selected.email}</div>
          <div><strong>Phone:</strong> {selected.phone}</div>
          <div><strong>Role:</strong> {selected.user_type}</div>
          <div><strong>Created:</strong> {selected.created_at}</div>
        </div>
      </Modal>}

      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

