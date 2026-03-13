export type AdminUser = {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  user_type?: string;
  is_verified?: boolean;
  is_admin?: boolean;
  designation?: string;
  created_at?: string;
};

