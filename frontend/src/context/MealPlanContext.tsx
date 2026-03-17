'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8005';

const getToken = () => {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('gharka_token');
  } catch {
    return null;
  }
};

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface MealPlanSummary {
  id: number;
  name: string;
  description?: string;
  week_start_date?: string;
  servings: number;
  status: string;
  created_at: string;
  slot_count: number;
}

export interface MealSlot {
  id: number;
  meal_plan_id: number;
  day_index: number;
  meal_type: string;
  recipe_id?: number;
  meal_name?: string;
  meal_json?: Record<string, any>;
  sort_order: number;
  recipe_title?: string;
  recipe_key?: string;
  image_path?: string;
}

export interface MealPlanDetail {
  plan: MealPlanSummary & { preferences_json?: Record<string, any> };
  slots: MealSlot[];
  daily_summary: { day_index: number; day_name: string; calories: number }[];
  shopping_list: string[];
}

export interface GenerateRequest {
  name?: string;
  dietary_preferences?: string[];
  allergies?: string[];
  servings?: number;
  cuisine_preference?: string;
  meal_types?: string[];
}

interface MealPlanContextType {
  plans: MealPlanSummary[];
  currentPlan: MealPlanDetail | null;
  loading: boolean;
  error: string | null;
  loadPlans: () => Promise<void>;
  loadPlan: (id: number) => Promise<void>;
  deletePlan: (id: number) => Promise<void>;
  generatePlan: (prefs: GenerateRequest) => Promise<MealPlanDetail>;
  swapSlot: (planId: number, slotId: number, data: { recipe_id?: number; meal_name?: string }) => Promise<void>;
  regeneratePlan: (planId: number, prefs?: GenerateRequest) => Promise<void>;
}

const MealPlanContext = createContext<MealPlanContextType | null>(null);

export const MealPlanProvider = ({ children }: { children: React.ReactNode }) => {
  const [plans, setPlans] = useState<MealPlanSummary[]>([]);
  const [currentPlan, setCurrentPlan] = useState<MealPlanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/meal-plans`, { headers: authHeaders() as HeadersInit });
      if (!res.ok) throw new Error('Failed to fetch meal plans');
      const json = await res.json();
      setPlans(json.plans ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlan = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/meal-plans/${id}`, { headers: authHeaders() as HeadersInit });
      if (!res.ok) throw new Error('Failed to fetch meal plan');
      const json = await res.json();
      setCurrentPlan(json);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePlan = useCallback(async (id: number) => {
    await fetch(`${API}/meal-plans/${id}`, { method: 'DELETE', headers: authHeaders() as HeadersInit });
    setPlans(prev => prev.filter(p => p.id !== id));
  }, []);

  const generatePlan = useCallback(async (prefs: GenerateRequest): Promise<MealPlanDetail> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/meal-plans/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() } as HeadersInit,
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.detail?.message ?? json?.detail ?? 'Generation failed';
        if (res.status === 403 && json?.detail?.upgrade_url) {
          throw Object.assign(new Error(msg), { upgradeRequired: true });
        }
        throw new Error(msg);
      }
      setCurrentPlan(json);
      return json;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const swapSlot = useCallback(async (planId: number, slotId: number, data: { recipe_id?: number; meal_name?: string }) => {
    const res = await fetch(`${API}/meal-plans/${planId}/slots/${slotId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() } as HeadersInit,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update slot');
    await loadPlan(planId);
  }, [loadPlan]);

  const regeneratePlan = useCallback(async (planId: number, prefs: GenerateRequest = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/meal-plans/${planId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() } as HeadersInit,
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error('Regeneration failed');
      const json = await res.json();
      setCurrentPlan(json);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <MealPlanContext.Provider value={{ plans, currentPlan, loading, error, loadPlans, loadPlan, deletePlan, generatePlan, swapSlot, regeneratePlan }}>
      {children}
    </MealPlanContext.Provider>
  );
};

export const useMealPlan = () => {
  const ctx = useContext(MealPlanContext);
  if (!ctx) throw new Error('useMealPlan must be used inside MealPlanProvider');
  return ctx;
};