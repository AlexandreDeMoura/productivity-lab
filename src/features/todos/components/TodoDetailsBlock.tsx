"use client";

import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";

import type { BlockLayout } from "@/features/todos/types/workspace";
import type { OptimisticTodo } from "@/features/todos/types/optimisticTodo";

type TodoDetailsBlockProps = {
  layout: BlockLayout;
  selectedTodo: OptimisticTodo | null;
  isFocused: boolean;
  onToggleFocus: () => void;
  onActivate: () => void;
  onClose: () => void;
  onDragStop: RndDragCallback;
  onResizeStop: RndResizeCallback;
  createdLabel: string | null;
  updatedLabel: string | null;
};

export function TodoDetailsBlock({
  layout,
  selectedTodo,
  isFocused,
  onToggleFocus,
  onActivate,
  onClose,
  onDragStop,
  onResizeStop,
  createdLabel,
  updatedLabel,
}: TodoDetailsBlockProps) {
  if (!selectedTodo) {
    return null;
  }

  return (
    <Rnd
      bounds="parent"
      size={{ width: layout.width, height: layout.height }}
      position={{ x: layout.x, y: layout.y }}
      minWidth={320}
      minHeight={360}
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
            aria-label="Drag Todo details block"
          >
            <span className="workspace-block__grip">
              <span />
              <span />
              <span />
            </span>
            <span className="workspace-block__title">Todo Details</span>
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
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onClose}
              className="workspace-block__action"
              aria-label="Close details block"
              title="Close details block"
            >
              Close
            </button>
          </div>
        </div>

        <section className="workspace-block__content glass-panel">
          <div className="space-y-6">
            <header className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-foreground-muted">
                Todo Details
              </p>
              <h2 className="text-2xl font-semibold leading-tight text-foreground">
                {selectedTodo.text}
              </h2>
            </header>

            <dl className="space-y-3 text-sm text-foreground-muted">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
                  Status
                </dt>
                <dd className="text-sm font-semibold text-foreground">
                  {selectedTodo.done ? "Completed" : "Active"}
                </dd>
              </div>

              {createdLabel && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
                    Created
                  </dt>
                  <dd className="text-sm text-foreground">{createdLabel}</dd>
                </div>
              )}

              {updatedLabel && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
                    Last updated
                  </dt>
                  <dd className="text-sm text-foreground">{updatedLabel}</dd>
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <dt className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
                  Owner
                </dt>
                <dd className="text-sm text-foreground">
                  {selectedTodo.user_id || "Unknown"}
                </dd>
              </div>
            </dl>

            <div className="todo-detail__summary space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                Overview
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                Manage this task from the Todos block. Any updates you apply
                there will refresh here automatically.
              </p>
            </div>
          </div>
        </section>
      </article>
    </Rnd>
  );
}
