import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe environment variable retrieval with fallback
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export let supabase: SupabaseClient | null = null;
export let isSupabaseConfigured = false;

if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    isSupabaseConfigured = true;
  } catch (err) {
    console.warn('Supabase client initialization failed, running in offline fallback mode:', err);
    supabase = null;
    isSupabaseConfigured = false;
  }
}

export async function testSupabaseConnection(url: string, key: string): Promise<{ success: boolean; message: string }> {
  if (!url || !key) {
    return { success: false, message: 'URL and Anon Key are required.' };
  }
  try {
    const testClient = createClient(url, key);
    const { error } = await testClient.from('customers').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: `Connected to Supabase, but encountered error: ${error.message}` };
    }
    return { success: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Supabase.' };
  }
}

