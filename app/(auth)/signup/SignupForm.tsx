"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignupForm() {
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

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // If the project has "email confirmation" disabled, a session will exist immediately.
    const redirectTo = data.session ? "/dashboard" : "/login";
    const redirectedFrom = searchParams.get("redirectedFrom");

    router.push(
      redirectedFrom ? `${redirectTo}?redirectedFrom=${encodeURIComponent(redirectedFrom)}` : redirectTo
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Sign up</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Create an account with email and password.
          </p>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-900">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              required
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
              autoComplete="email"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-900">Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              required
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
              autoComplete="new-password"
            />
          </label>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating..." : "Sign up"}
        </button>

        <div className="mt-4 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link className="font-medium text-zinc-900 hover:underline" href="/login">
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}

