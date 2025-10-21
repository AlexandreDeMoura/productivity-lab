'use client';

import { FormEvent, useState } from "react";

type Filter = "all" | "active" | "completed";

type Todo = {
  id: number;
  text: string;
  done: boolean;
};

const initialTodos: Todo[] = [
  { id: 1, text: "Explore the design system tokens", done: false },
  { id: 2, text: "Build a themed component within Pandora", done: true },
  { id: 3, text: "Ship a polished todo experience", done: false },
];

const filters: Array<{ label: string; value: Filter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
];

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [newTodo, setNewTodo] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = newTodo.trim();
    if (!value) {
      return;
    }

    setTodos((previous) => [
      ...previous,
      { id: Date.now(), text: value, done: false },
    ]);
    setNewTodo("");
  };

  const toggleTodo = (id: number) => {
    setTodos((previous) =>
      previous.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    );
  };

  const removeTodo = (id: number) => {
    setTodos((previous) => previous.filter((todo) => todo.id !== id));
  };

  const clearCompleted = () => {
    setTodos((previous) => previous.filter((todo) => !todo.done));
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-12 px-6 py-16">
      <section className="grid w-full gap-6 rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-soft)] transition-colors sm:grid-cols-[2fr_1fr]">
        <article className="flex h-full flex-col justify-between gap-6 rounded-md border border-dashed border-border bg-background p-6 transition-colors">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Today&apos;s plan</h2>
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
              />
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent/90"
              >
                Add task
              </button>
            </form>

            <div className="space-y-3">
              {filteredTodos.length > 0 ? (
                filteredTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm transition hover:bg-background-muted/60"
                  >
                    <input
                      id={`todo-${todo.id}`}
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => toggleTodo(todo.id)}
                      className="size-4 rounded border-border bg-background text-accent focus:ring-2 focus:ring-accent/40"
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
                      onClick={() => removeTodo(todo.id)}
                      className="rounded-md border border-transparent px-2 py-1 text-xs font-semibold text-foreground-muted transition hover:border-border hover:text-foreground"
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
                onClick={clearCompleted}
                className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground-muted transition hover:bg-surface-hover hover:text-foreground"
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
