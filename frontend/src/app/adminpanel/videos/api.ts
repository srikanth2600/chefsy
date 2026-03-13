export async function fetchVideosApi(token: string) {
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005'}/admin/videos`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch videos (${res.status})`);
  return await res.json();
}

export async function createVideoApi(token: string, payload: any) {
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005'}/admin/videos/create`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create failed (${res.status})`);
  return await res.json();
}

export async function updateVideoApi(token: string, id: number, payload: any) {
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005'}/admin/videos/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  return await res.json();
}

export async function deleteVideoApi(token: string, id: number) {
  const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005'}/admin/videos/${id}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
  return await res.json();
}

