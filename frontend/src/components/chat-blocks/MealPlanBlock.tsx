'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MEAL_ICONS: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

interface MealPlanBlockContent {
  plan_id?: number;
  plan_name?: string;
  summary?: {
    total_slots?: number;
    slot_counts_by_day?: number[];
    meal_types?: string[];
  };
}

export default function MealPlanBlock({ content }: { content: MealPlanBlockContent }) {
  const router = useRouter();
  const { plan_id, plan_name, summary } = content;

  const slotCounts = summary?.slot_counts_by_day ?? Array(7).fill(summary?.total_slots ? Math.round(summary.total_slots / 7) : 0);
  const mealTypes = summary?.meal_types ?? ['breakfast', 'lunch', 'dinner'];

  if (!plan_id) return null;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        borderRadius: 'var(--radius-md, 12px)',
        padding: '18px 20px',
        maxWidth: 480,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22 }}>🍽️</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {plan_name ?? 'Your Meal Plan'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>7-day AI generated plan</div>
        </div>
      </div>

      {/* Mini grid — meal types × days */}
      <div style={{ display: 'grid', gridTemplateColumns: `50px repeat(7, 1fr)`, gap: 4, marginBottom: 16 }}>
        {/* Header row */}
        <div />
        {DAY_SHORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>{d}</div>
        ))}
        {/* Meal rows */}
        {mealTypes.map(mt => (
          <React.Fragment key={mt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13 }}>{MEAL_ICONS[mt] ?? '🍴'}</span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{mt}</span>
            </div>
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                style={{
                  height: 20,
                  borderRadius: 4,
                  background: slotCounts[i] > 0 ? 'rgba(218,119,86,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${slotCounts[i] > 0 ? 'rgba(218,119,86,0.4)' : 'transparent'}`,
                }}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => router.push(`/meal-plans/${plan_id}`)}
          style={{
            flex: 2,
            background: 'var(--claude-orange)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 0',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          View Full Plan
        </button>
        <button
          onClick={() => router.push('/meal-plans')}
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: 8,
            padding: '9px 0',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          All Plans
        </button>
      </div>
    </div>
  );
}