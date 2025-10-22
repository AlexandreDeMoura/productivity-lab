"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/features/auth/actions/authActions";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = (formData.get("email") as string | null)?.trim() ?? "";
    const password = formData.get("password") as string | null;
    const confirmPassword = formData.get("confirmPassword") as string | null;

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await signUp({ email, password: password ?? "" });
      if (result.success) {
        router.replace("/sign-in?registered=1");
      } else {
        setError(result.error ?? "Failed to sign up");
      }
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-surface p-8 shadow-[var(--shadow-soft)]">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="text-sm text-foreground-muted">
            Start tracking your todos in seconds.
          </p>
        </header>

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
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="At least 6 characters"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Repeat your password"
              disabled={isPending}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
          >
            {isPending ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="text-center text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link className="font-medium text-accent hover:underline" href="/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
