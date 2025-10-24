"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
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
  onUpdateDescription: (id: number, description: string) => Promise<boolean>;
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
  onUpdateDescription,
}: TodoDetailsBlockProps) {
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastTodoIdRef = useRef<number | null>(null);
  const selectedTodoId = selectedTodo?.id ?? null;
  const selectedTodoDescription = selectedTodo?.description ?? null;

  useEffect(() => {
    if (selectedTodoId === null) {
      setDescriptionDraft("");
      setIsDirty(false);
      setIsSubmitting(false);
      lastTodoIdRef.current = null;
      return;
    }

    const nextValue = selectedTodoDescription ?? "";
    if (lastTodoIdRef.current !== selectedTodoId) {
      lastTodoIdRef.current = selectedTodoId;
      setDescriptionDraft(nextValue);
      setIsDirty(false);
      setIsSubmitting(false);
      return;
    }

    setDescriptionDraft((current) => {
      if (isDirty) {
        return current;
      }
      if (current === nextValue) {
        return current;
      }
      return nextValue;
    });
  }, [selectedTodoId, selectedTodoDescription, isDirty]);

  if (!selectedTodo) {
    return null;
  }

  const normalizedCurrentDescription = (selectedTodo.description ?? "").trim();
  const hasSavedDescription = normalizedCurrentDescription.length > 0;
  const helperText = isSubmitting
    ? "Saving description…"
    : isDirty
      ? "You have unsaved changes."
      : hasSavedDescription
        ? "Description saved."
        : "No description yet. Add more context above.";

  const handleDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setDescriptionDraft(nextValue);

    const nextNormalized = nextValue.trim();
    setIsDirty(nextNormalized !== normalizedCurrentDescription);
  };

  const handleDescriptionReset = () => {
    setDescriptionDraft(selectedTodo.description ?? "");
    setIsDirty(false);
  };

  const handleDescriptionSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    const draftBeforeSubmit = descriptionDraft;
    const nextNormalized = draftBeforeSubmit.trim();

    if (nextNormalized === normalizedCurrentDescription) {
      setDescriptionDraft(selectedTodo.description ?? "");
      setIsDirty(false);
      return;
    }

    setDescriptionDraft(nextNormalized);
    setIsSubmitting(true);
    const didSucceed = await onUpdateDescription(
      selectedTodo.id,
      draftBeforeSubmit
    );
    setIsSubmitting(false);

    if (didSucceed) {
      setIsDirty(false);
    } else {
      setIsDirty(true);
    }
  };

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
                Description
              </h3>
              <form onSubmit={handleDescriptionSubmit} className="space-y-3">
                <textarea
                  value={descriptionDraft}
                  onChange={handleDescriptionChange}
                  placeholder="Add more context or next steps…"
                  className="w-full min-h-[140px] resize-none rounded-2xl border border-border bg-surface/80 px-4 py-3 text-sm leading-relaxed text-foreground shadow-[var(--shadow-soft)] transition focus:border-accent focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting}
                />
                <div className="flex flex-col gap-2 text-xs text-foreground-subtle sm:flex-row sm:items-center sm:justify-between">
                  <p className="leading-5">{helperText}</p>
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <button
                        type="button"
                        onClick={handleDescriptionReset}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-foreground-muted transition hover:border-foreground-subtle hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmitting}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center justify-center rounded-full border border-border px-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-foreground transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!isDirty || isSubmitting}
                    >
                      {isSubmitting ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>
      </article>
    </Rnd>
  );
}
