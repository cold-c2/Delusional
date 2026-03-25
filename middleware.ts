import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isProtectedPath(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/leaderboard" ||
    pathname.startsWith("/leaderboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/task" ||
    pathname.startsWith("/task/")
  );
}

export async function middleware(request: NextRequest) {
  // Only run auth logic on protected routes (matcher is an extra guardrail).
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          // Re-create the response when cookies change.
          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and getClaims().
  await supabase.auth.getClaims();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set(
      "redirectedFrom",
      request.nextUrl.pathname
    );
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/task/:path*",
    "/leaderboard/:path*",
    "/admin/:path*",
  ],
};

