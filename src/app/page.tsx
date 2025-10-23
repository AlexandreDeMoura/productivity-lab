'use client';

import {
  FormEvent,
  useState,
  useEffect,
  useTransition,
  useOptimistic,
  useMemo,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  getTodos,
  createTodo,
  toggleTodo,
  deleteTodo,
  clearCompletedTodos,
} from "@/features/todos/actions/todoActions";
import { signOut } from "@/features/auth/actions/authActions";
import type { Todo } from "@/types/database";

type OptimisticTodo = Todo & { optimistic?: boolean };

type OptimisticAction =
  | { type: "create"; todo: OptimisticTodo }
  | { type: "toggle"; id: number }
  | { type: "delete"; id: number }
  | { type: "clearCompleted" };

export default function Home() {
  const [todos, setTodos] = useState<OptimisticTodo[]>([]);
  const [optimisticTodos, updateOptimisticTodos] = useOptimistic<
    OptimisticTodo[],
    OptimisticAction
  >(todos, (currentTodos, action) => {
    switch (action.type) {
      case "create":
        return [...currentTodos, action.todo];
      case "toggle":
        return currentTodos.map((todo) =>
          todo.id === action.id
            ? { ...todo, done: !todo.done, optimistic: true }
            : todo
        );
      case "delete":
        return currentTodos.filter((todo) => todo.id !== action.id);
      case "clearCompleted":
        return currentTodos.filter((todo) => !todo.done);
      default:
        return currentTodos;
    }
  });
  const [newTodo, setNewTodo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSignOutPending, startSignOutTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const router = useRouter();

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }),
    []
  );

  const fullDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    []
  );

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

  const sortByCreatedAt = (a: OptimisticTodo, b: OptimisticTodo) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

  const activeTodos = optimisticTodos
    .filter((todo) => !todo.done)
    .sort(sortByCreatedAt);

  const completedTodos = optimisticTodos
    .filter((todo) => todo.done)
    .sort(sortByCreatedAt);

  const remaining = activeTodos.length;
  const completedCount = completedTodos.length;

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
    const tempId = -Math.floor(Math.random() * 1_000_000 + Date.now());
    const now = new Date().toISOString();
    const optimisticTodo: OptimisticTodo = {
      id: tempId,
      text: value,
      done: false,
      user_id: "optimistic",
      created_at: now,
      updated_at: now,
      optimistic: true,
    };
    setNewTodo("");
    startTransition(async () => {
      updateOptimisticTodos({ type: "create", todo: optimisticTodo });
      const result = await createTodo({ text: value });
      if (result.success && result.data) {
        setTodos((previous) => [...previous, result.data!]);
      } else {
        setError(result.error || "Failed to create todo");
        setNewTodo(value);
      }
    });
  };

  const handleToggleTodo = async (id: number) => {
    setError(null);
    startTransition(async () => {
      updateOptimisticTodos({ type: "toggle", id });
      const result = await toggleTodo({ id });
      if (result.success && result.data) {
        setTodos((previous) =>
          previous.map((todo) => (todo.id === id ? result.data! : todo))
        );
      } else {
        setError(result.error || "Failed to toggle todo");
      }
    });
  };

  const handleRemoveTodo = async (id: number) => {
    setError(null);
    startTransition(async () => {
      updateOptimisticTodos({ type: "delete", id });
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
      updateOptimisticTodos({ type: "clearCompleted" });
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

  const renderTodo = (todo: OptimisticTodo) => {
    const isCompleted = todo.done;
    const isDisabled = isPending || todo.optimistic;
    const createdAt = new Date(todo.created_at);
    const createdOn = Number.isNaN(createdAt.getTime())
      ? null
      : dayFormatter.format(createdAt);

    return (
      <div
        key={todo.id}
        className={`todo-item group ${
          todo.optimistic ? "todo-item--optimistic" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => handleToggleTodo(todo.id)}
          className={`todo-checkbox ${isCompleted ? "todo-checkbox--checked" : ""}`}
          aria-pressed={isCompleted}
          aria-label={isCompleted ? "Mark todo as active" : "Mark todo as done"}
          disabled={isDisabled}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5">
            <path
              d="M16.5 5.75 8.25 14 4.5 10.25"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />
          </svg>
        </button>

        <div className="flex flex-1 flex-col gap-1">
          <p className={`todo-text ${isCompleted ? "todo-text--completed" : ""}`}>
            {todo.text}
          </p>
          {createdOn && (
            <span className="todo-meta">Added {createdOn}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleRemoveTodo(todo.id)}
          className="todo-action"
          disabled={isDisabled}
          aria-label="Delete todo"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
            <path
              d="m6 6 8 8M14 6l-8 8"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.6"
            />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <main className="flex min-h-screen justify-center bg-background px-4 py-16 sm:px-6 sm:py-24">
      <div className="w-full max-w-[40rem]">
        <section className="glass-panel">
          <header className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-4">
              <p className="text-[13px] font-medium uppercase tracking-[0.32em] text-foreground-muted">
                Calm Productivity
              </p>
              <div>
                <h1 className="text-[28px] font-semibold leading-tight tracking-[0.5px] text-foreground">
                  Today&apos;s Focus
                </h1>
                <p className="mt-2 text-sm font-medium tracking-[0.12em] text-foreground-subtle">
                  {fullDateLabel}
                </p>
              </div>
              <p className="text-sm text-foreground-muted">
                {remaining === 0
                  ? "Your mind is clear. Enjoy the calm."
                  : `${remaining} ${remaining === 1 ? "task" : "tasks"} waiting patiently.`}
              </p>
            </div>

            {isAuthenticated ? (
              <button
                onClick={handleSignOut}
                className="inline-flex h-10 min-w-[3.5rem] items-center justify-center rounded-full border border-border px-4 text-xs font-semibold cursor-pointer uppercase tracking-[0.2em] text-foreground-muted transition hover:border-accent/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSignOutPending}
              >
                {isSignOutPending ? "Signing out…" : "Sign out"}
              </button>
            ) : (
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-foreground-muted">
                <Link href="/sign-in" className="transition hover:text-foreground">
                  Sign in
                </Link>
                <span className="px-1 text-foreground-subtle">/</span>
                <Link href="/sign-up" className="transition hover:text-foreground">
                  Sign up
                </Link>
              </div>
            )}
          </header>

          <form
            onSubmit={handleSubmit}
            className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="input-shell">
              <input
                value={newTodo}
                onChange={(event) => setNewTodo(event.target.value)}
                placeholder="Add a gentle reminder…"
                className="input-field"
                aria-label="New todo"
                disabled={isPending || !isAuthenticated}
              />
            </div>
            <button
              type="submit"
              className="accent-button"
              disabled={isPending || !isAuthenticated || !newTodo.trim()}
            >
              {isPending ? "Adding…" : <Plus className="h-5 w-5" />}
            </button>
          </form>

          {!isAuthenticated && (
            <p className="mt-3 text-xs font-medium tracking-[0.16em] text-foreground-subtle">
              Sign in to start curating your list.
            </p>
          )}

          {error && (
            <div className="notice notice--error">
              <p>{error}</p>
              {error === "You must be logged in to view todos" && (
                <p className="notice__cta">
                  <Link
                    className="underline-offset-4 transition hover:text-foreground"
                    href="/sign-in"
                  >
                    Sign in
                  </Link>{" "}
                  or{" "}
                  <Link
                    className="underline-offset-4 transition hover:text-foreground"
                    href="/sign-up"
                  >
                    create an account
                  </Link>{" "}
                  to manage your todos.
                </p>
              )}
            </div>
          )}

          <section className="mt-12 space-y-8">
            <div>
              <h2 className="section-title">Active</h2>
              <div className="mt-6 space-y-4">
                {isLoading ? (
                  <p className="text-sm text-foreground-subtle">
                    Loading your tasks…
                  </p>
                ) : activeTodos.length > 0 ? (
                  activeTodos.map(renderTodo)
                ) : (
                  <div className="empty-state">
                    <div className="empty-state__icon" aria-hidden="true">
                      <svg viewBox="0 0 40 40" className="h-10 w-10">
                        <circle
                          cx="20"
                          cy="20"
                          r="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeDasharray="2 4"
                        />
                        <path
                          d="M16 22.5c1.2 1 2.8 1.6 4 1.6 1.2 0 2.8-.6 4-1.6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          fill="none"
                        />
                        <circle cx="17" cy="17" r="1.4" fill="currentColor" />
                        <circle cx="23" cy="17" r="1.4" fill="currentColor" />
                      </svg>
                    </div>
                    <div>
                      <p className="empty-state__title">
                        {isAuthenticated
                          ? "Your mind is clear."
                          : "Nothing to see just yet."}
                      </p>
                      <p className="empty-state__copy">
                        {isAuthenticated
                          ? "Capture what matters next when the moment arises."
                          : "Sign in to reveal your calm, focused list."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {completedCount > 0 && (
              <div className="completed-section">
                <button
                  type="button"
                  onClick={() => setShowCompleted((previous) => !previous)}
                  className="completed-toggle"
                  aria-expanded={showCompleted}
                >
                  <span>Completed ({completedCount})</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`h-4 w-4 transition-transform duration-200 ${
                      showCompleted ? "rotate-180" : ""
                    }`}
                  >
                    <path
                      d="M6 8l4 4 4-4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                    />
                  </svg>
                </button>

                {showCompleted && (
                  <div className="completed-list">
                    {completedTodos.map(renderTodo)}
                    <button
                      type="button"
                      onClick={handleClearCompleted}
                      className="completed-clear"
                      disabled={isPending}
                    >
                      Clear completed
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
