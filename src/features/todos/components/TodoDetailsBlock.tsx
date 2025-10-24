"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
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
  onUpdateText: (id: number, text: string) => Promise<boolean>;
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
  onUpdateText,
}: TodoDetailsBlockProps) {
  const [titleDraft, setTitleDraft] = useState("");
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [isTitleSubmitting, setIsTitleSubmitting] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const lastTodoIdRef = useRef<number | null>(null);
  const selectedTodoId = selectedTodo?.id ?? null;
  const selectedTodoText = selectedTodo?.text ?? "";
  const selectedTodoDescription = selectedTodo?.description ?? null;

  useEffect(() => {
    if (selectedTodoId === null) {
      setTitleDraft("");
      setIsTitleEditing(false);
      setIsTitleSubmitting(false);
      setDescriptionDraft("");
      setIsDirty(false);
      setIsSubmitting(false);
      lastTodoIdRef.current = null;
      return;
    }

    const nextTitle = selectedTodoText;
    const nextDescription = selectedTodoDescription ?? "";
    if (lastTodoIdRef.current !== selectedTodoId) {
      lastTodoIdRef.current = selectedTodoId;
      setTitleDraft(nextTitle);
      setIsTitleEditing(false);
      setIsTitleSubmitting(false);
      setDescriptionDraft(nextDescription);
      setIsDirty(false);
      setIsSubmitting(false);
      return;
    }

    setTitleDraft((current) => {
      if (isTitleEditing) {
        return current;
      }
      if (current === nextTitle) {
        return current;
      }
      return nextTitle;
    });

    setDescriptionDraft((current) => {
      if (isDirty) {
        return current;
      }
      if (current === nextDescription) {
        return current;
      }
      return nextDescription;
    });
  }, [
    selectedTodoId,
    selectedTodoDescription,
    selectedTodoText,
    isDirty,
    isTitleEditing,
  ]);

  useEffect(() => {
    if (isTitleEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isTitleEditing]);

  if (!selectedTodo) {
    return null;
  }

  const normalizedCurrentTitle = selectedTodoText.trim();
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

  const handleStartEditingTitle = () => {
    setTitleDraft(selectedTodo.text);
    setIsTitleEditing(true);
    setIsTitleSubmitting(false);
  };

  const handleCancelTitleEdit = () => {
    setTitleDraft(selectedTodo.text);
    setIsTitleEditing(false);
    setIsTitleSubmitting(false);
  };

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitleDraft(event.target.value);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelTitleEdit();
    }
  };

  const handleTitleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValue = titleDraft.trim();
    const currentValue = normalizedCurrentTitle;

    if (nextValue.length === 0) {
      setTitleDraft(selectedTodo.text);
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
      return;
    }

    if (nextValue === currentValue) {
      setTitleDraft(selectedTodo.text);
      setIsTitleEditing(false);
      return;
    }

    setTitleDraft(nextValue);
    setIsTitleSubmitting(true);
    let didSucceed = false;
    try {
      didSucceed = await onUpdateText(selectedTodo.id, nextValue);
    } finally {
      setIsTitleSubmitting(false);
    }

    if (didSucceed) {
      setIsTitleEditing(false);
    } else {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  };

  const isTitleSaveDisabled =
    isTitleSubmitting || titleDraft.trim().length === 0 ||
    titleDraft.trim() === normalizedCurrentTitle;

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
              {isTitleEditing ? (
                <form onSubmit={handleTitleSubmit} className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <input
                      ref={titleInputRef}
                      value={titleDraft}
                      onChange={handleTitleChange}
                      onKeyDown={handleTitleKeyDown}
                      className="w-full rounded-2xl border border-border bg-surface/80 px-4 py-3 text-lg font-semibold leading-tight text-foreground shadow-[var(--shadow-soft)] transition focus:border-accent focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Todo title"
                      disabled={isTitleSubmitting}
                      aria-label="Todo title"
                    />
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={handleCancelTitleEdit}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-[0.7rem] font-semibold uppercase cursor-pointer tracking-[0.18em] text-foreground-muted transition hover:border-foreground-subtle hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isTitleSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center justify-center rounded-full border border-border px-4 text-[0.7rem] font-semibold uppercase cursor-pointer tracking-[0.18em] text-foreground transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isTitleSaveDisabled}
                      >
                        {isTitleSubmitting ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <h2
                    className="text-2xl font-semibold leading-tight text-foreground"
                    onDoubleClick={handleStartEditingTitle}
                    title="Double-click to edit title"
                  >
                    {selectedTodo.text}
                  </h2>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={handleStartEditingTitle}
                    className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-[0.7rem] font-semibold uppercase cursor-pointer tracking-[0.18em] text-foreground-muted transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    aria-label="Edit todo title"
                    title="Edit todo title"
                  >
                    Edit
                  </button>
                </div>
              )}
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
                        className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-[0.7rem] font-semibold uppercase cursor-pointer tracking-[0.18em] text-foreground-muted transition hover:border-foreground-subtle hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isSubmitting}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center justify-center rounded-full border border-border px-4 text-[0.7rem] font-semibold uppercase cursor-pointer tracking-[0.18em] text-foreground transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
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
