export async function fetchUsersApi(token: string, q: string | null, page: number, perPage: number) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('per_page', String(perPage));
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005'}/admin/users?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
  return await res.json();
}

