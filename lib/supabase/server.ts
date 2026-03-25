import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component Supabase client.
 * Creates a request-scoped client wired to Next.js cookies.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Next.js throws when setting cookies from Server Components.
            // Token refresh is handled by the `middleware` proxy.
          }
        },
      },
    }
  );
}

