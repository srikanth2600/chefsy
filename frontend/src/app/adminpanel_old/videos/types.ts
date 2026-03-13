export type AdminVideo = {
  id: number;
  user_id?: number;
  recipe_id?: number;
  url: string;
  title?: string;
  description?: string;
  keywords?: string;
  keywords_json?: string[] | null;
  category?: string;
  thumbnail?: string;
  channel?: string;
  watch_count?: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

