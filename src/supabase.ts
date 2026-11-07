import { createClient } from '@supabase/supabase-js';

// This is the public browser key for the existing KDS AI Supabase project.
// Publishable keys are designed for client-side use; never put a service-role key here.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || 'https://eopvkwhcgznvubesaszv.supabase.co';
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_d3hVgDqwTuB63BtfumPwoQ_ngy2ig_c';

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// AFTERSTATE-specific tables must use the afterstate_ prefix and RLS.
// Existing KDS AI tables and functions are intentionally left untouched.
