"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { signIn } from "@/features/auth/actions/authActions";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const successMessage = useMemo(() => {
    if (searchParams?.get("registered") === "1") {
      return "Account created! You can sign in now.";
    }
    return null;
  }, [searchParams]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = (formData.get("email") as string | null)?.trim() ?? "";
    const password = formData.get("password") as string | null;

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await signIn({ email, password: password ?? "" });
      if (result.success) {
        router.replace("/");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to sign in");
      }
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-surface p-8 shadow-[var(--shadow-soft)]">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-foreground-muted">
            Sign in to access your todos.
          </p>
        </header>

        {successMessage && (
          <div className="rounded-md border border-green-500 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-400 dark:bg-green-950/20 dark:text-green-300">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-500 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-400 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="you@example.com"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="••••••••"
              disabled={isPending}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-foreground-muted">
          Don&apos;t have an account?{" "}
          <Link className="font-medium text-accent hover:underline" href="/sign-up">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
