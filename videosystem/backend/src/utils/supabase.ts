import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create Supabase client with service role key for backend operations
export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create Supabase client for client-side operations (if needed)
export const createClientSupabase = (supabaseAccessToken: string) => {
  return createClient<Database>(supabaseUrl, supabaseAccessToken, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export default supabase;