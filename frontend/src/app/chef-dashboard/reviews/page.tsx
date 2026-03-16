'use client';

/**
 * /chef-dashboard/reviews
 * Shows all recipe reviews received by the chef.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useChefTheme } from '@/components/chef/ChefThemeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8005';
const tok = () => { try { return localStorage.getItem('gharka_token') || ''; } catch { return ''; } };

type Review = {
  id: number;
  recipe_id: number;
  recipe_title: string;
  reviewer_name: string;
  rating: number;
  review_text?: string;
  created_at: string;
};

const Stars = ({ rating, color }: { rating: number; color: string }) => (
  <span style={{ color, fontSize: 13, letterSpacing: 1 }}>
    {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
  </span>
);

const RatingBar = ({ value, total, color, bg }: { value: number; total: number; color: string; bg: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ flex: 1, height: 6, borderRadius: 99, background: bg, overflow: 'hidden' }}>
      <div style={{ width: `${total ? (value / total) * 100 : 0}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s' }} />
    </div>
    <span style={{ fontSize: 11, color, minWidth: 18, textAlign: 'right' }}>{value}</span>
  </div>
);

export default function ReviewsPage() {
  const { t } = useChefTheme();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Review | null>(null);
  const perPage = 15;

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/chefs/me/reviews?page=${pg}&per_page=${perPage}`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setReviews(data.reviews || []);
      setTotal(data.total || 0);
      setPage(pg);
    } catch (e: any) {
      setError(e.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  // Stats
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';
  const dist = [5, 4, 3, 2, 1].map(n => ({
    star: n,
    count: reviews.filter(r => r.rating === n).length,
  }));

  const totalPages = Math.ceil(total / perPage);

  return (
    <div style={{ padding: '24px', color: t.textPrimary, fontFamily: 'var(--font-dm-sans), DM Sans, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: t.textPrimary, letterSpacing: '-0.02em' }}>
          ⭐ Reviews
        </h1>
        <p style={{ fontSize: 12, color: t.textTertiary, margin: 0 }}>
          What users say about your recipes
        </p>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        {/* Avg rating card */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textTertiary, margin: '0 0 6px' }}>
            Average Rating
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: t.warning }}>{avgRating}</span>
            <span style={{ fontSize: 12, color: t.textTertiary }}>/5</span>
          </div>
          <Stars rating={Math.round(parseFloat(avgRating) || 0)} color={t.warning} />
        </div>

        {/* Total reviews card */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textTertiary, margin: '0 0 6px' }}>
            Total Reviews
          </p>
          <span style={{ fontSize: 32, fontWeight: 800, color: t.textPrimary }}>{total}</span>
        </div>

        {/* Distribution card */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: '16px 18px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textTertiary, margin: '0 0 10px' }}>
            Rating Distribution
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dist.map(d => (
              <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: t.warning, minWidth: 20 }}>{'★'.repeat(d.star)}</span>
                <RatingBar value={d.count} total={reviews.length} color={t.warning} bg={t.border} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: `${t.error}18`, border: `1px solid ${t.error}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: t.error, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>All Reviews</span>
          <span style={{ fontSize: 11, color: t.textTertiary }}>{total} total</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>Loading…</div>
        ) : reviews.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⭐</div>
            <p style={{ fontSize: 14, color: t.textTertiary, margin: 0 }}>No reviews yet</p>
            <p style={{ fontSize: 12, color: t.textTertiary, marginTop: 4 }}>Reviews will appear here when users rate your recipes</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Recipe', 'Reviewer', 'Rating', 'Review', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textTertiary, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviews.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(selected?.id === r.id ? null : r)}
                    style={{
                      borderBottom: `1px solid ${t.border}`,
                      cursor: 'pointer',
                      background: selected?.id === r.id ? t.accentBg : 'transparent',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (selected?.id !== r.id) (e.currentTarget as HTMLElement).style.background = t.bgSurface; }}
                    onMouseLeave={e => { if (selected?.id !== r.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: t.accent, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.recipe_title}
                    </td>
                    <td style={{ padding: '12px 16px', color: t.textSecondary }}>
                      {r.reviewer_name || 'Anonymous'}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <Stars rating={r.rating} color={t.warning} />
                    </td>
                    <td style={{ padding: '12px 16px', color: t.textSecondary, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.review_text || <span style={{ color: t.textTertiary, fontStyle: 'italic' }}>No text</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: t.textTertiary, whiteSpace: 'nowrap', fontSize: 11 }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail panel */}
        {selected && (
          <div style={{
            borderTop: `1px solid ${t.border}`,
            padding: '18px 20px',
            background: t.bgSurface,
            animation: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: t.textPrimary, margin: '0 0 2px' }}>
                  {selected.reviewer_name || 'Anonymous'} on <span style={{ color: t.accent }}>{selected.recipe_title}</span>
                </p>
                <Stars rating={selected.rating} color={t.warning} />
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary, fontSize: 18, padding: 0 }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: 13, color: t.textSecondary, margin: '0 0 8px', lineHeight: 1.6 }}>
              {selected.review_text || <span style={{ fontStyle: 'italic', color: t.textTertiary }}>No review text provided.</span>}
            </p>
            <p style={{ fontSize: 11, color: t.textTertiary, margin: 0 }}>
              {new Date(selected.created_at).toLocaleString()} · Recipe ID: {selected.recipe_id}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: t.textTertiary }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1}
                style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: page <= 1 ? t.textTertiary : t.textPrimary, cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit' }}
              >
                ← Prev
              </button>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= totalPages}
                style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${t.border}`, background: 'transparent', color: page >= totalPages ? t.textTertiary : t.textPrimary, cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 12, fontFamily: 'inherit' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
