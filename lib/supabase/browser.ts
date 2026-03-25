import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser/Client Component Supabase client.
 * Uses the publishable key and browser cookies for auth state.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

