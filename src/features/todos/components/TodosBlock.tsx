"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import type {
  ChangeEventHandler,
  FormEvent,
  ReactNode,
} from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";

import type { BlockLayout } from "@/features/todos/types/workspace";
import type { OptimisticTodo } from "@/features/todos/types/optimisticTodo";

type TodosBlockProps = {
  layout: BlockLayout;
  isFocused: boolean;
  onToggleFocus: () => void;
  onActivate: () => void;
  onDragStop: RndDragCallback;
  onResizeStop: RndResizeCallback;
  remainingCount: number;
  fullDateLabel: string;
  isAuthenticated: boolean;
  isSignOutPending: boolean;
  onSignOut: () => Promise<void> | void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  newTodoValue: string;
  onNewTodoChange: ChangeEventHandler<HTMLInputElement>;
  isPending: boolean;
  isLoading: boolean;
  error: string | null;
  activeTodos: OptimisticTodo[];
  completedTodos: OptimisticTodo[];
  renderTodo: (todo: OptimisticTodo) => ReactNode;
  showCompleted: boolean;
  onToggleShowCompleted: () => void;
  onClearCompleted: () => void;
};

export function TodosBlock({
  layout,
  isFocused,
  onToggleFocus,
  onActivate,
  onDragStop,
  onResizeStop,
  remainingCount,
  fullDateLabel,
  isAuthenticated,
  isSignOutPending,
  onSignOut,
  onSubmit,
  newTodoValue,
  onNewTodoChange,
  isPending,
  isLoading,
  error,
  activeTodos,
  completedTodos,
  renderTodo,
  showCompleted,
  onToggleShowCompleted,
  onClearCompleted,
}: TodosBlockProps) {
  const completedCount = completedTodos.length;

  return (
    <Rnd
      bounds="parent"
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      minWidth={360}
      minHeight={420}
      style={{ zIndex: layout.z }}
      dragHandleClassName="workspace-block__drag-region"
      enableResizing={{
        bottom: true,
        bottomLeft: true,
        bottomRight: true,
        left: true,
        right: true,
        top: true,
        topLeft: true,
        topRight: true,
      }}
      onDragStop={onDragStop}
      onResizeStop={onResizeStop}
      onMouseDown={onActivate}
    >
      <article
        className={`workspace-block ${
          isFocused ? "workspace-block--focused" : ""
        }`}
        onMouseDownCapture={onActivate}
      >
        <div className="workspace-block__chrome">
          <div
            className="workspace-block__drag-region"
            aria-label="Drag Todos block"
          >
            <span className="workspace-block__grip">
              <span />
              <span />
              <span />
            </span>
            <span className="workspace-block__title">Todos</span>
          </div>
          <div className="workspace-block__actions">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onToggleFocus}
              className="workspace-block__action"
              aria-pressed={isFocused}
              aria-label={
                isFocused
                  ? "Exit focus and restore previous size"
                  : "Focus this block"
              }
              title={
                isFocused
                  ? "Exit focus and restore previous size"
                  : "Focus this block"
              }
            >
              {isFocused ? "Exit focus" : "Focus"}
            </button>
          </div>
        </div>

        <section className="workspace-block__content glass-panel">
          <header className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-4">
              <div>
                <h1 className="text-[28px] font-semibold leading-tight tracking-[0.5px] text-foreground">
                  Today&apos;s Focus
                </h1>
                <p className="mt-2 text-sm font-medium tracking-[0.12em] text-foreground-subtle">
                  {fullDateLabel}
                </p>
              </div>
              <p className="text-sm text-foreground-muted">
                {remainingCount === 0
                  ? "Your mind is clear. Enjoy the calm."
                  : `${remainingCount} ${
                      remainingCount === 1 ? "task" : "tasks"
                    } waiting patiently.`}
              </p>
            </div>

            {isAuthenticated ? (
              <button
                onClick={() => onSignOut()}
                className="inline-flex h-10 min-w-[3.5rem] items-center justify-center rounded-full border border-border px-4 text-xs font-semibold cursor-pointer uppercase tracking-[0.2em] text-foreground-muted transition hover:border-accent/60 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSignOutPending}
              >
                {isSignOutPending ? "Signing out…" : "Sign out"}
              </button>
            ) : (
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-foreground-muted">
                <Link
                  href="/sign-in"
                  className="transition hover:text-foreground"
                >
                  Sign in
                </Link>
                <span className="px-1 text-foreground-subtle">/</span>
                <Link
                  href="/sign-up"
                  className="transition hover:text-foreground"
                >
                  Sign up
                </Link>
              </div>
            )}
          </header>

          <form
            onSubmit={onSubmit}
            className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="input-shell">
              <input
                value={newTodoValue}
                onChange={onNewTodoChange}
                placeholder="Add a gentle reminder…"
                className="input-field"
                aria-label="New todo"
                disabled={isPending || !isAuthenticated}
              />
            </div>
            <button
              type="submit"
              className="accent-button"
              disabled={isPending || !isAuthenticated || !newTodoValue.trim()}
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

          <section className="mt-8 space-y-6">
            <div>
              <h2 className="section-title">Active</h2>
              <div className="mt-6 space-y-4">
                {isLoading ? (
                  <p className="text-sm text-foreground-subtle">
                    Loading your tasks…
                  </p>
                ) : activeTodos.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__body">
                      <p className="empty-state__eyebrow">
                        {isAuthenticated
                          ? "The slate is clear."
                          : "Welcome to your calm corner."}
                      </p>
                      <p className="empty-state__headline">
                        {isAuthenticated
                          ? "Ready for what&apos;s next?"
                          : "Sign in to unlock your focus."}
                      </p>
                      <p className="empty-state__copy">
                        {isAuthenticated
                          ? "Capture what matters next when the moment arises."
                          : "Sign in to reveal your calm, focused list."}
                      </p>
                    </div>
                  </div>
                ) : (
                  activeTodos.map(renderTodo)
                )}
              </div>
            </div>

            {completedCount > 0 && (
              <div className="completed-section">
                <button
                  type="button"
                  onClick={onToggleShowCompleted}
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
                      onClick={onClearCompleted}
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
      </article>
    </Rnd>
  );
}
