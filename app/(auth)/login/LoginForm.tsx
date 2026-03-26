"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const redirectTo = searchParams.get("redirectedFrom") ?? "/dashboard";
    router.push(redirectTo);
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border bg-zinc-800 p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Use your email and password to continue.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-100">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              required
              className="w-full rounded-lg border bg-zinc-700 border-zinc-600 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500/20 placeholder-zinc-400"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-100">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              required
              className="w-full rounded-lg border bg-zinc-700 border-zinc-600 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-500/20 placeholder-zinc-400"
              autoComplete="current-password"
            />
          </label>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-900 bg-red-900/20 px-3 py-2 text-sm text-red-400" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="mt-4 text-center text-sm text-zinc-400">
          Don’t have an account?{" "}
          <Link className="font-medium text-zinc-100 hover:underline" href="/signup">
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}

