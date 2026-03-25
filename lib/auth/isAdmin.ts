import type { SupabaseClient } from "@supabase/supabase-js";

type ClaimsResponse = {
  data: { claims: Record<string, any> | null };
  error: unknown;
};

/**
 * Determines admin status from JWT claims.
 *
 * Supports common patterns:
 * - `role: "admin"`
 * - `app_metadata.role: "admin"`
 * - `user_metadata.role: "admin"`
 * - `is_admin: true`
 */
export async function isAdminFromClaims(supabase: SupabaseClient) {
  const { data, error } = (await (supabase as any).auth.getClaims()) as ClaimsResponse;
  if (error) return false;

  const claims = data?.claims ?? null;
  if (!claims) return false;

  const directRole = claims.role;
  const appRole = claims.app_metadata?.role;
  const userRole = claims.user_metadata?.role;
  const isAdminFlag = claims.is_admin;

  return (
    directRole === "admin" ||
    appRole === "admin" ||
    userRole === "admin" ||
    isAdminFlag === true
  );
}

