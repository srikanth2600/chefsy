'use client';
/**
 * Analytics  /adminpanel/analytics
 * APIs needed (build these):
 *   GET /admin/analytics/overview  → { daily_chats:[{date,count}], top_cuisines:[{name,count}],
 *                                       user_growth:[{date,count}], cache_hit_rate, avg_response_ms,
 *                                       top_queries:[{query,count}] }
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };
const hdr = () => ({ Authorization: `Bearer ${tok()}` });

type AnalyticsData = {
  daily_chats:    { date: string; count: number }[];
  user_growth:    { date: string; count: number }[];
  top_cuisines:   { name: string; count: number }[];
  top_queries:    { query: string; count: number }[];
  cache_hit_rate: number;
  avg_response_ms:number;
  total_likes:    number;
  total_dislikes: number;
};

const RANGE_OPTIONS = [
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
];

function BarChart({ data, color = 'var(--acc)' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
      {data.map((v, i) => (
        <div key={i} title={String(v)}
          style={{ flex: 1, borderRadius: '3px 3px 0 0', minHeight: 3,
            height: `${Math.round((v / max) * 100)}%`,
            background: i === data.length - 1 ? color : `${color}66`,
            transition: 'all 0.2s', cursor: 'default' }}
        />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [range,   setRange]   = useState('30');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!tok()) { router.push('/adminpanel/login'); return; }
    setLoading(true);
    fetch(`${API}/admin/analytics/overview?days=${range}`, { headers: hdr() })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setData(j); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [range]); // eslint-disable-line

  const chatCounts    = data?.daily_chats?.map(d => d.count)  ?? Array(7).fill(0);
  const userCounts    = data?.user_growth?.map(d => d.count)  ?? Array(7).fill(0);
  const topCuisines   = data?.top_cuisines ?? [];
  const topQueries    = data?.top_queries  ?? [];
  const maxCuisine    = Math.max(...topCuisines.map(c => c.count), 1);
  const maxQuery      = Math.max(...topQueries.map(q => q.count), 1);

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Analytics</div>
          <div className="adm-ph-sub">Platform usage insights and trends</div>
        </div>
        <div className="adm-ph-actions">
          {RANGE_OPTIONS.map(o => (
            <button key={o.value} className={`adm-btn adm-btn-sm ${range === o.value ? 'adm-btn-primary' : 'adm-btn-ghost'}`}
              onClick={() => setRange(o.value)}>{o.label}</button>
          ))}
        </div>
      </div>

      {error && <div style={{ background: 'var(--ard)', color: 'var(--ar)', padding: '10px 14px', borderRadius: 'var(--r)', marginBottom: 14, fontSize: 13 }}>⚠ {error} — showing placeholder data</div>}

      {/* KPI row */}
      <div className="adm-stats adm-mb3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' }}>
        {[
          { color: 'c-blue',   icon: '◻', label: 'Total Chats',    value: chatCounts.reduce((a,b)=>a+b,0) },
          { color: 'c-green',  icon: '◎', label: 'New Users',      value: userCounts.reduce((a,b)=>a+b,0) },
          { color: 'c-orange', icon: '⚡', label: 'Cache Hit Rate', value: `${data?.cache_hit_rate ?? 0}%` },
          { color: 'c-yellow', icon: '⏱', label: 'Avg Response',   value: data?.avg_response_ms ? `${data.avg_response_ms}ms` : '—' },
          { color: 'c-purple', icon: '✦', label: 'Total Likes',    value: data?.total_likes ?? 0 },
          { color: 'c-red',    icon: '↓', label: 'Dislikes',       value: data?.total_dislikes ?? 0 },
        ].map((s, i) => (
          <div key={i} className={`adm-stat ${s.color}`}>
            <div className="adm-stat-icon">{s.icon}</div>
            <div className="adm-stat-val">{loading ? <span className="adm-sk" style={{ display: 'block', height: 24, width: 50 }} /> : s.value}</div>
            <div className="adm-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="adm-grid2 adm-mb3" style={{ gap: 14 }}>
        <div className="adm-card">
          <div className="adm-card-hd">
            <span className="adm-card-title">◻ Daily Chat Volume</span>
            <span style={{ fontSize: 11, color: 'var(--at3)' }}>Last {range} days</span>
          </div>
          <div className="adm-card-bd">
            {loading ? <div className="adm-sk" style={{ height: 80 }} /> : <BarChart data={chatCounts} color="var(--abl)" />}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--at3)' }}>{data?.daily_chats?.[0]?.date ?? ''}</span>
              <span style={{ fontSize: 10, color: 'var(--at3)' }}>{data?.daily_chats?.at(-1)?.date ?? ''}</span>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-card-hd">
            <span className="adm-card-title">◎ User Growth</span>
            <span style={{ fontSize: 11, color: 'var(--at3)' }}>Last {range} days</span>
          </div>
          <div className="adm-card-bd">
            {loading ? <div className="adm-sk" style={{ height: 80 }} /> : <BarChart data={userCounts} color="var(--ag)" />}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--at3)' }}>{data?.user_growth?.[0]?.date ?? ''}</span>
              <span style={{ fontSize: 10, color: 'var(--at3)' }}>{data?.user_growth?.at(-1)?.date ?? ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lists row */}
      <div className="adm-grid2" style={{ gap: 14 }}>
        {/* Top cuisines */}
        <div className="adm-card">
          <div className="adm-card-hd">
            <span className="adm-card-title">🍳 Top Cuisines Requested</span>
          </div>
          <div className="adm-card-bd" style={{ padding: '8px 18px 14px' }}>
            {loading ? Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'center' }}>
                <div className="adm-sk" style={{ height: 12, flex: 1 }} />
                <div className="adm-sk" style={{ height: 12, width: 30 }} />
              </div>
            )) : topCuisines.length === 0 ? (
              <div className="adm-empty" style={{ padding: '20px 0' }}>
                <div className="adm-empty-title">No data yet</div>
              </div>
            ) : topCuisines.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < topCuisines.length - 1 ? '1px solid var(--ae)' : 'none' }}>
                <span style={{ width: 18, fontSize: 11, color: 'var(--at3)', fontFamily: 'var(--fm)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--at)' }}>{c.name}</span>
                <div style={{ width: 80 }}>
                  <div style={{ height: 4, background: 'var(--ab3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, background: 'var(--acc)', width: `${Math.round((c.count / maxCuisine) * 100)}%` }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--at3)', fontFamily: 'var(--fm)', width: 32, textAlign: 'right', flexShrink: 0 }}>{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top search queries */}
        <div className="adm-card">
          <div className="adm-card-hd">
            <span className="adm-card-title">🔍 Top Search Queries</span>
          </div>
          <div className="adm-card-bd" style={{ padding: '8px 18px 14px' }}>
            {loading ? Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'center' }}>
                <div className="adm-sk" style={{ height: 12, flex: 1 }} />
                <div className="adm-sk" style={{ height: 12, width: 30 }} />
              </div>
            )) : topQueries.length === 0 ? (
              <div className="adm-empty" style={{ padding: '20px 0' }}>
                <div className="adm-empty-title">No data yet</div>
              </div>
            ) : topQueries.map((q, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < topQueries.length - 1 ? '1px solid var(--ae)' : 'none' }}>
                <span style={{ width: 18, fontSize: 11, color: 'var(--at3)', fontFamily: 'var(--fm)', textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--at)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</span>
                <div style={{ width: 80 }}>
                  <div style={{ height: 4, background: 'var(--ab3)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, background: 'var(--abl)', width: `${Math.round((q.count / maxQuery) * 100)}%` }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--at3)', fontFamily: 'var(--fm)', width: 32, textAlign: 'right', flexShrink: 0 }}>{q.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
