// ─── Chef Module Shared Types ──────────────────────────────────────────────

export interface Chef {
  id: number;
  name: string;
  slug: string;
  role: string;
  speciality: string;
  location: string;
  rating: number | null;
  review_count: number;
  recipe_count: number;
  follower_count: number;
  verified: boolean;
  featured: boolean;
  avatar_color: string; // fallback hex when no photo
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  cuisine_tags?: string[];
  youtube_url?: string;
  instagram_url?: string;
  website_url?: string;
  plan: 'free' | 'pro';
  appearance_theme?: AppearanceTheme;
  videos?: ChefVideo[];
  experience_years?: number | null;
  certifications?: string[];
}

export interface ChefVideo {
  id: number;
  title: string;
  youtube_url: string;
  thumbnail_url?: string;
  duration?: string;
  view_count?: string;
}

export interface Recipe {
  id: number;
  title: string;
  chef: Chef;
  cuisine: string;
  difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Expert';
  cook_time: string;
  servings?: number;
  like_count: number;
  dislike_count?: number;
  comment_count: number;
  view_count?: string;
  emoji?: string;
  image_url?: string;
  description?: string;
  steps?: string[];
  ingredients?: RecipeIngredient[];
  nutrition?: NutritionInfo;
  is_published?: boolean;
  created_at?: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface RecipeComment {
  id: number;
  user_name: string;
  user_color: string;
  text: string;
  time_ago: string;
  like_count: number;
  liked_by_me?: boolean;
}

export interface AppearanceTheme {
  banner_color: string;
  accent_color: string;
  font: string;
  bg_style: 'dark' | 'warm' | 'forest';
}

export type ChefTab = 'chefs' | 'reels' | 'recipes';
export type ProfileTab = 'posts' | 'reels' | 'about';
export type DashTab = 'overview' | 'recipes' | 'analytics' | 'profile';
