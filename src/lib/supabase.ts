import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawAnonKey &&
  !rawUrl.includes('tu-proyecto-id') &&
  !rawAnonKey.includes('tu_clave_publica')
);

// Fallback safe placeholder when env vars are not set during initial build
const supabaseUrl = rawUrl || 'https://unconfigured-project.supabase.co';
const supabaseAnonKey = rawAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
