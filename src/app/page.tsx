'use client';

import { FormEvent, useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getTodos, createTodo, toggleTodo, deleteTodo, clearCompletedTodos } from "@/features/todos/actions/todoActions";
import { signOut } from "@/features/auth/actions/authActions";
import type { Todo } from "@/types/database";

type Filter = "all" | "active" | "completed";

const filters: Array<{ label: string; value: Filter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
];

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [isPending, startTransition] = useTransition();
  const [isSignOutPending, startSignOutTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // Load todos on mount
  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getTodos();
    if (result.success && result.data) {
      setTodos(result.data);
      setIsAuthenticated(true);
    } else {
      setError(result.error || "Failed to load todos");
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  };

  const filteredTodos = todos.filter((todo) => {
    if (filter === "completed") {
      return todo.done;
    }
    if (filter === "active") {
      return !todo.done;
    }
    return true;
  });

  const remaining = todos.filter((todo) => !todo.done).length;
  const completed = todos.length - remaining;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthenticated) {
      setError("Please sign in to add todos");
      return;
    }
    const value = newTodo.trim();
    if (!value) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createTodo({ text: value });
      if (result.success && result.data) {
        setTodos((previous) => [result.data!, ...previous]);
        setNewTodo("");
      } else {
        setError(result.error || "Failed to create todo");
      }
    });
  };

  const handleToggleTodo = async (id: number) => {
    setError(null);
    startTransition(async () => {
      const result = await toggleTodo({ id });
      if (result.success && result.data) {
        setTodos((previous) =>
          previous.map((todo) =>
            todo.id === id ? result.data! : todo
          )
        );
      } else {
        setError(result.error || "Failed to toggle todo");
      }
    });
  };

  const handleRemoveTodo = async (id: number) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteTodo({ id });
      if (result.success) {
        setTodos((previous) => previous.filter((todo) => todo.id !== id));
      } else {
        setError(result.error || "Failed to delete todo");
      }
    });
  };

  const handleClearCompleted = async () => {
    setError(null);
    startTransition(async () => {
      const result = await clearCompletedTodos();
      if (result.success) {
        setTodos((previous) => previous.filter((todo) => !todo.done));
      } else {
        setError(result.error || "Failed to clear completed todos");
      }
    });
  };

  const handleSignOut = async () => {
    setError(null);
    startSignOutTransition(async () => {
      const result = await signOut();
      if (result.success) {
        setTodos([]);
        setIsAuthenticated(false);
        router.replace("/sign-in");
        router.refresh();
      } else {
        setError(result.error || "Failed to sign out");
      }
    });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-16">
      <header className="flex w-full items-center justify-end gap-4">
        {isAuthenticated ? (
          <button
            onClick={handleSignOut}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:bg-background disabled:opacity-50"
            disabled={isSignOutPending}
          >
            {isSignOutPending ? "Signing out..." : "Sign out"}
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <span>Have an account?</span>
            <Link
              href="/sign-in"
              className="font-semibold text-accent hover:underline"
            >
              Sign in
            </Link>
            <span>/</span>
            <Link
              href="/sign-up"
              className="font-semibold text-accent hover:underline"
            >
              Sign up
            </Link>
          </div>
        )}
      </header>
      <section className="grid w-full gap-6 rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-soft)] transition-colors sm:grid-cols-[2fr_1fr]">
        <article className="flex h-full flex-col justify-between gap-6 rounded-md border border-dashed border-border bg-background p-6 transition-colors">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Today&apos;s plan</h2>
            
            {error && (
              <div className="rounded-md border border-red-500 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
                {error === "You must be logged in to view todos" && (
                  <p className="mt-2 text-xs">
                    <Link className="font-medium text-accent" href="/sign-in">
                      Sign in
                    </Link>{" "}
                    or{" "}
                    <Link className="font-medium text-accent" href="/sign-up">
                      create an account
                    </Link>{" "}
                    to manage your todos.
                  </p>
                )}
              </div>
            )}
            
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 sm:flex-row"
            >
              <input
                value={newTodo}
                onChange={(event) => setNewTodo(event.target.value)}
                placeholder="Add a new task..."
                className="w-full rounded-md border border-transparent bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="New todo"
                disabled={isPending || !isAuthenticated}
              />
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
                disabled={isPending || !isAuthenticated}
              >
                Add task
              </button>
            </form>

            <div className="space-y-3">
              {isLoading ? (
                <div className="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-foreground-muted">
                  Loading todos...
                </div>
              ) : filteredTodos.length > 0 ? (
                filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm transition hover:bg-background-muted/60"
                  >
                    <input
                      id={`todo-${todo.id}`}
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => handleToggleTodo(todo.id)}
                      className="size-4 rounded border-border bg-background text-accent focus:ring-2 focus:ring-accent/40"
                      disabled={isPending}
                    />
                    <label
                      htmlFor={`todo-${todo.id}`}
                      className={`flex-1 text-sm transition ${
                        todo.done
                          ? "text-foreground-muted line-through"
                          : "text-foreground"
                      }`}
                    >
                      {todo.text}
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveTodo(todo.id)}
                      className="rounded-md border border-transparent px-2 py-1 text-xs font-semibold text-foreground-muted transition hover:border-border hover:text-foreground disabled:opacity-50"
                      disabled={isPending}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-foreground-muted">
                  No tasks found for this view. Create a new one above or
                  switch the filter.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-hover p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-wide text-foreground-muted">
                {remaining} active
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs uppercase tracking-wide text-foreground-muted">
                {completed} done
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filters.map(({ label, value }) => {
                const isActive = filter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${
                      isActive
                        ? "border-accent bg-accent text-accent-foreground shadow-sm"
                        : "border-border text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleClearCompleted}
                className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground-muted transition hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
                disabled={isPending}
              >
                Clear completed
              </button>
            </div>
          </div>
        </article>

        <aside className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-background p-4 transition-colors">
            <p className="text-xs uppercase tracking-wide text-foreground-muted">
              Theme aware
            </p>
            <p className="text-sm text-foreground">
              Task surfaces adapt to the active theme so the checklist always
              feels native to the rest of Pandora.
            </p>
          </div>
          <div className="rounded-md border border-border bg-background p-4 transition-colors">
            <p className="text-xs uppercase tracking-wide text-foreground-muted">
              Focus friendly
            </p>
            <p className="text-sm text-foreground">
              Use filters to narrow your focus, whether you&apos;re planning or
              celebrating completed work.
            </p>
          </div>
          <div className="rounded-md border border-dashed border-border bg-background p-4 transition-colors text-sm text-foreground-muted">
            Every interaction relies on tokens, ensuring consistent spacing,
            color, and typography across the experience.
          </div>
        </aside>
      </section>
    </main>
  );
}
