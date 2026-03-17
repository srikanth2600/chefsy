'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// AI Recipes lives on the main chat page (/).
// This redirect ensures sidebar links don't 404.
export default function RecipesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)', fontSize: 14 }}>
      Loading AI Recipes…
    </div>
  );
}
