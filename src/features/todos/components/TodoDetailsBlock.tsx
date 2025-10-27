"use client";

import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";

import type { BlockLayout } from "@/features/todos/types/workspace";
import type { OptimisticTodo } from "@/features/todos/types/optimisticTodo";

const EMPTY_CONTENT_JSON = "[]";

const serializeContent = (content: PartialBlock[]): string =>
  JSON.stringify(content);

const deserializeContent = (json: string): PartialBlock[] => {
  try {
    return JSON.parse(json) as PartialBlock[];
  } catch {
    return [];
  }
};

const createParagraphBlocksFromText = (text: string): PartialBlock[] => {
  const lines = text.split(/\r?\n/);
  return lines.map((line) =>
    line.length > 0
      ? {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: line,
            },
          ],
        }
      : { type: "paragraph" }
  );
};

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
  onUpdateContent: (id: number, content: PartialBlock[]) => Promise<boolean>;
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
  onUpdateContent,
  onUpdateText,
}: TodoDetailsBlockProps) {
  const [titleDraft, setTitleDraft] = useState("");
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [isTitleSubmitting, setIsTitleSubmitting] = useState(false);
  const [contentDraftJSON, setContentDraftJSON] = useState(EMPTY_CONTENT_JSON);
  const [isContentDirty, setIsContentDirty] = useState(false);
  const [isContentSubmitting, setIsContentSubmitting] = useState(false);
  const [editor, setEditor] = useState<BlockNoteEditor | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const lastTodoIdRef = useRef<number | null>(null);
  const lastSyncedContentRef = useRef<string>(EMPTY_CONTENT_JSON);
  const selectedTodoId = selectedTodo?.id ?? null;
  const selectedTodoText = selectedTodo?.text ?? "";

  useEffect(() => {
    if (selectedTodoId === null) {
      setTitleDraft("");
      setIsTitleEditing(false);
      setIsTitleSubmitting(false);
      lastTodoIdRef.current = null;
      return;
    }

    const nextTitle = selectedTodoText;
    if (lastTodoIdRef.current !== selectedTodoId) {
      lastTodoIdRef.current = selectedTodoId;
      setTitleDraft(nextTitle);
      setIsTitleEditing(false);
      setIsTitleSubmitting(false);
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
  }, [selectedTodoId, selectedTodoText, isTitleEditing]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const newEditor = BlockNoteEditor.create();
    setEditor(newEditor);

    return () => {
      newEditor.destroy();
      setEditor(null);
    };
  }, []);

  const normalizedContentJSON = useMemo(() => {
    if (!selectedTodo) {
      return EMPTY_CONTENT_JSON;
    }

    if (Array.isArray(selectedTodo.content) && selectedTodo.content.length > 0) {
      return serializeContent(selectedTodo.content);
    }

    const fallback =
      (selectedTodo.description ?? "").trim() || selectedTodo.text.trim();

    if (fallback.length === 0) {
      return EMPTY_CONTENT_JSON;
    }

    return serializeContent(createParagraphBlocksFromText(fallback));
  }, [selectedTodo]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (selectedTodoId === null) {
      setContentDraftJSON(EMPTY_CONTENT_JSON);
      setIsContentDirty(false);
      setIsContentSubmitting(false);
      lastSyncedContentRef.current = EMPTY_CONTENT_JSON;
      return;
    }

    const baselineJSON = normalizedContentJSON;
    let nextSyncedJSON = baselineJSON;

    const currentJSON = JSON.stringify(editor.document);
    if (currentJSON !== baselineJSON) {
      const baselineContent = deserializeContent(baselineJSON);
      const replacement = baselineContent.length > 0 ? baselineContent : [];
      editor.replaceBlocks(editor.document, replacement);
      nextSyncedJSON = JSON.stringify(editor.document);
    } else {
      nextSyncedJSON = currentJSON;
    }

    lastSyncedContentRef.current = nextSyncedJSON;
    setContentDraftJSON(nextSyncedJSON);
    setIsContentDirty(false);
    setIsContentSubmitting(false);
  }, [selectedTodoId, normalizedContentJSON, editor]);

  useEffect(() => {
    if (isTitleEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isTitleEditing]);

  const contentHelperText = !editor
    ? "Loading editor…"
    : isContentSubmitting
      ? "Saving content…"
      : isContentDirty
        ? "You have unsaved changes."
        : "All changes saved.";

  const handleEditorChange = useCallback(
    (editorInstance: BlockNoteEditor) => {
      const json = JSON.stringify(editorInstance.document);
      setContentDraftJSON(json);
      setIsContentDirty(json !== lastSyncedContentRef.current);
    },
    []
  );

  const handleContentReset = useCallback(() => {
    if (!editor) {
      return;
    }

    const baselineContent = deserializeContent(lastSyncedContentRef.current);
    const replacement = baselineContent.length > 0 ? baselineContent : [];
    editor.replaceBlocks(editor.document, replacement);
    const nextJSON = JSON.stringify(editor.document);
    setContentDraftJSON(nextJSON);
    setIsContentDirty(false);
  }, [editor]);

  if (!selectedTodo) {
    return null;
  }

  const normalizedCurrentTitle = selectedTodoText.trim();

  const handleContentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTodo || !editor || !isContentDirty || isContentSubmitting) {
      return;
    }

    const contentToSave = deserializeContent(contentDraftJSON);
    setIsContentSubmitting(true);
    const didSucceed = await onUpdateContent(selectedTodo.id, contentToSave);
    setIsContentSubmitting(false);

    if (didSucceed) {
      const serialized = serializeContent(contentToSave);
      lastSyncedContentRef.current = serialized;
      setContentDraftJSON(serialized);
      setIsContentDirty(false);
    } else {
      setIsContentDirty(true);
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
            </dl>

            <div className="todo-detail__summary space-y-3 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted pb-2 border-b border-border">
                Notes
              </h3>
              <form onSubmit={handleContentSubmit} className="space-y-3">
                  {editor ? (
                    <BlockNoteView
                      editor={editor}
                      onChange={handleEditorChange}
                      theme="light"
                      className="bn-editor text-foreground w-full"
                    />
                  ) : (
                    <p className="px-2 py-6 text-sm text-foreground-muted">
                      Initializing editor…
                    </p>
                  )}
                <div className="flex flex-col gap-2 border-t border-border pt-4 text-xs text-foreground-subtle sm:flex-row sm:items-center sm:justify-between">
                  <p className="leading-5">{contentHelperText}</p>
                  <div className="flex items-center gap-2">
                    {isContentDirty && (
                      <button
                        type="button"
                        onClick={handleContentReset}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-border px-3 text-[0.7rem] font-semibold uppercase cursor-pointer tracking-[0.18em] text-foreground-muted transition hover:border-foreground-subtle hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isContentSubmitting || !editor}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center justify-center rounded-full border border-border px-4 text-[0.7rem] font-semibold uppercase cursor-pointer tracking-[0.18em] text-foreground transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!editor || !isContentDirty || isContentSubmitting}
                    >
                      {isContentSubmitting ? "Saving…" : "Save"}
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
