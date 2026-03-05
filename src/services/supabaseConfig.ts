import { createClient } from '@supabase/supabase-js';
import { SecureTokenStore } from './secureTokenStore';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl) {
    throw new Error(
        '[FATAL] Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL\n' +
        'Set this to your Supabase project URL (e.g. https://your-project-ref.supabase.co).\n' +
        'Found in: Supabase Dashboard > Settings > API > Project URL'
    );
}
if (!supabaseAnonKey) {
    throw new Error(
        '[FATAL] Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
        'Set this to your Supabase anon/public key.\n' +
        'Found in: Supabase Dashboard > Settings > API > Project API keys > anon public'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: SecureTokenStore,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
