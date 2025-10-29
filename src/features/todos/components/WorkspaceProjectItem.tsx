"use client";

import {
  useState,
  useMemo,
  useTransition,
  useOptimistic,
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { PartialBlock } from "@blocknote/core";
import type { RndDragCallback, RndResizeCallback } from "react-rnd";

import { TodosBlock } from "@/features/todos/components/TodosBlock";
import { TodoDetailsBlock } from "@/features/todos/components/TodoDetailsBlock";
import type { OptimisticTodo } from "@/features/todos/types/optimisticTodo";
import type {
  BlockLayout,
  BlockRect,
} from "@/features/todos/types/workspace";
import type { ActionResponse, Todo } from "@/types/database";
import type {
  CreateTodoInput,
  ToggleTodoInput,
  DeleteTodoInput,
  UpdateTodoContentInput,
  UpdateTodoTextInput,
} from "@/features/todos/schemas/todoSchemas";

type FocusableBlock = "todos" | "details";

type RequireProjectId<T extends { project_id?: number }> = Omit<
  T,
  "project_id"
> & {
  project_id: number;
};

type WorkspaceProjectActions = {
  createTodo: (
    input: RequireProjectId<CreateTodoInput>
  ) => Promise<ActionResponse<Todo>>;
  toggleTodo: (
    input: RequireProjectId<ToggleTodoInput>
  ) => Promise<ActionResponse<Todo>>;
  deleteTodo: (
    input: RequireProjectId<DeleteTodoInput>
  ) => Promise<ActionResponse<void>>;
  clearCompletedTodos: (input: {
    project_id: number;
  }) => Promise<ActionResponse<void>>;
  updateTodoContent: (
    input: RequireProjectId<UpdateTodoContentInput>
  ) => Promise<ActionResponse<Todo>>;
  updateTodoText: (
    input: RequireProjectId<UpdateTodoTextInput>
  ) => Promise<ActionResponse<Todo>>;
};

type WorkspaceProjectLayouts = {
  todos: BlockLayout;
  details: BlockLayout;
};

type WorkspaceProjectItemProps = {
  projectId: number;
  projectName: string;
  layouts: WorkspaceProjectLayouts;
  focusedBlock: FocusableBlock | null;
  selectedTodoId: number | null;
  todos: OptimisticTodo[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isSignOutPending: boolean;
  onSignOut: () => Promise<void> | void;
  actions: WorkspaceProjectActions;
  onUpdateLayout: (
    projectId: number,
    block: FocusableBlock,
    layout: Partial<BlockLayout>
  ) => void;
  onFocusChange?: (
    projectId: number,
    block: FocusableBlock | null
  ) => void;
  onActivateBlock?: (projectId: number, block: FocusableBlock) => void;
  onSelectedTodoChange: (projectId: number, todoId: number | null) => void;
  onTodosChange?: (projectId: number, todos: OptimisticTodo[]) => void;
  onError?: (projectId: number, message: string | null) => void;
  getCanvasBounds?: () => DOMRect | null;
  fullDateLabel?: string;
  initialShowCompleted?: boolean;
  externalError?: string | null;
};

type OptimisticAction =
  | { type: "create"; todo: OptimisticTodo }
  | { type: "toggle"; id: number }
  | { type: "delete"; id: number }
  | { type: "clearCompleted" }
  | { type: "updateContent"; id: number; content: PartialBlock[] }
  | { type: "updateText"; id: number; text: string };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const computeDetailBlockPlacement = (
  todosLayout: BlockLayout,
  detailLayout: BlockLayout | undefined,
  canvasRect: DOMRect | null
): BlockRect => {
  const gap = 24;
  const padding = 32;
  const fallbackWidth =
    typeof window !== "undefined"
      ? window.innerWidth
      : todosLayout.x + todosLayout.width + gap;
  const fallbackHeight =
    typeof window !== "undefined"
      ? window.innerHeight
      : todosLayout.y + todosLayout.height + gap;

  const containerWidth = canvasRect?.width ?? fallbackWidth;
  const containerHeight = canvasRect?.height ?? fallbackHeight;

  const minWidth = 320;
  const minHeight = 420;
  const effectiveMinWidth = Math.max(
    Math.min(minWidth, containerWidth - padding * 2),
    240
  );
  const effectiveMinHeight = Math.max(
    Math.min(minHeight, containerHeight - padding * 2),
    320
  );

  const preferredWidth = clamp(
    detailLayout?.width ?? 420,
    effectiveMinWidth,
    Math.max(effectiveMinWidth, containerWidth - padding * 2)
  );
  const preferredHeight = clamp(
    detailLayout?.height ?? 520,
    effectiveMinHeight,
    Math.max(effectiveMinHeight, containerHeight - padding * 2)
  );

  const attemptRight = (): BlockRect | null => {
    const availableWidth =
      containerWidth - padding - (todosLayout.x + todosLayout.width + gap);
    if (availableWidth < effectiveMinWidth) {
      return null;
    }

    const width = Math.min(preferredWidth, availableWidth);
    const x = todosLayout.x + todosLayout.width + gap;
    const y = clamp(
      todosLayout.y,
      padding,
      containerHeight - preferredHeight - padding
    );
    const availableHeight = containerHeight - padding - y;
    if (availableHeight < effectiveMinHeight) {
      return null;
    }

    const height = Math.min(preferredHeight, availableHeight);
    return { x, y, width, height };
  };

  const attemptLeft = (): BlockRect | null => {
    const availableWidth = todosLayout.x - padding - gap;
    if (availableWidth < effectiveMinWidth) {
      return null;
    }

    const width = Math.min(preferredWidth, availableWidth);
    const x = todosLayout.x - gap - width;
    const y = clamp(
      todosLayout.y,
      padding,
      containerHeight - preferredHeight - padding
    );
    const availableHeight = containerHeight - padding - y;
    if (availableHeight < effectiveMinHeight) {
      return null;
    }

    const height = Math.min(preferredHeight, availableHeight);
    return { x, y, width, height };
  };

  const attemptBelow = (): BlockRect | null => {
    const availableHeight =
      containerHeight - padding - (todosLayout.y + todosLayout.height + gap);
    if (availableHeight < effectiveMinHeight) {
      return null;
    }

    const height = Math.min(preferredHeight, availableHeight);
    const y = todosLayout.y + todosLayout.height + gap;
    const x = clamp(
      todosLayout.x,
      padding,
      containerWidth - preferredWidth - padding
    );
    const availableWidth = containerWidth - padding - x;
    if (availableWidth < effectiveMinWidth) {
      return null;
    }

    const width = Math.min(preferredWidth, availableWidth);
    return { x, y, width, height };
  };

  const attemptAbove = (): BlockRect | null => {
    const availableHeight = todosLayout.y - padding - gap;
    if (availableHeight < effectiveMinHeight) {
      return null;
    }

    const height = Math.min(preferredHeight, availableHeight);
    const y = todosLayout.y - gap - height;
    const x = clamp(
      todosLayout.x,
      padding,
      containerWidth - preferredWidth - padding
    );
    const availableWidth = containerWidth - padding - x;
    if (availableWidth < effectiveMinWidth) {
      return null;
    }

    const width = Math.min(preferredWidth, availableWidth);
    return { x, y, width, height };
  };

  return (
    attemptRight() ??
    attemptLeft() ??
    attemptBelow() ??
    attemptAbove() ?? {
      x: clamp(
        (containerWidth - preferredWidth) / 2,
        padding,
        Math.max(padding, containerWidth - preferredWidth - padding)
      ),
      y: clamp(
        (containerHeight - preferredHeight) / 2,
        padding,
        Math.max(padding, containerHeight - preferredHeight - padding)
      ),
      width: preferredWidth,
      height: preferredHeight,
    }
  );
};

const computeFocusLayout = (
  layout: BlockLayout,
  canvasRect?: DOMRect | null
): BlockLayout => {
  const padding = 32;
  const containerWidth = canvasRect?.width ?? window.innerWidth;
  const containerHeight = canvasRect?.height ?? window.innerHeight;
  const maxWidth = Math.max(420, containerWidth - padding * 2);
  const maxHeight = Math.max(480, containerHeight - padding * 2);
  const width = Math.min(Math.max(layout.width, 520), maxWidth);
  const height = Math.min(Math.max(layout.height, 580), maxHeight);
  const maxX = Math.max(padding, containerWidth - width - padding);
  const maxY = Math.max(padding, containerHeight - height - padding);

  return {
    ...layout,
    width,
    height,
    x: clamp((containerWidth - width) / 2, padding, maxX),
    y: clamp((containerHeight - height) / 2, padding, maxY),
  };
};

export function WorkspaceProjectItem({
  projectId,
  projectName,
  layouts,
  focusedBlock,
  selectedTodoId,
  todos,
  isAuthenticated,
  isLoading,
  isSignOutPending,
  onSignOut,
  actions,
  onUpdateLayout,
  onFocusChange,
  onActivateBlock,
  onSelectedTodoChange,
  onTodosChange,
  onError,
  getCanvasBounds,
  fullDateLabel,
  initialShowCompleted,
  externalError,
}: WorkspaceProjectItemProps) {
  const { todos: todosLayout, details: detailsLayout } = layouts;
  const {
    createTodo,
    toggleTodo,
    deleteTodo,
    clearCompletedTodos,
    updateTodoContent,
    updateTodoText,
  } = actions;
  const [todosState, setTodosState] = useState<OptimisticTodo[]>(todos);
  const [newTodo, setNewTodo] = useState("");
  const [showCompleted, setShowCompleted] = useState(
    initialShowCompleted ?? false
  );
  const [error, setError] = useState<string | null>(externalError ?? null);
  const [isPending, startTransition] = useTransition();
  const [optimisticTodos, updateOptimisticTodos] = useOptimistic<
    OptimisticTodo[],
    OptimisticAction
  >(todosState, (currentTodos, action) => {
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
      case "updateContent":
        return currentTodos.map((todo) =>
          todo.id === action.id
            ? {
                ...todo,
                content: action.content,
                optimistic: true,
                updated_at: new Date().toISOString(),
              }
            : todo
        );
      case "updateText":
        return currentTodos.map((todo) =>
          todo.id === action.id
            ? {
                ...todo,
                text: action.text,
                optimistic: true,
                updated_at: new Date().toISOString(),
              }
            : todo
        );
      default:
        return currentTodos;
    }
  });
  const previousLayoutsRef = useRef<
    Partial<Record<FocusableBlock, BlockLayout>>
  >({});
  const projectLabel = projectName.trim();

  useEffect(() => {
    setTodosState(todos);
  }, [todos]);

  useEffect(() => {
    if (externalError !== undefined) {
      setError(externalError ?? null);
    }
  }, [externalError]);

  const setAndPropagateError = useCallback(
    (message: string | null) => {
      setError(message);
      onError?.(projectId, message);
    },
    [onError, projectId]
  );

  const commitTodos = useCallback(
    (
      next:
        | OptimisticTodo[]
        | ((previous: OptimisticTodo[]) => OptimisticTodo[])
    ) => {
      setTodosState((previous) => {
        const updated = typeof next === "function" ? next(previous) : next;
        onTodosChange?.(projectId, updated);
        return updated;
      });
    },
    [onTodosChange, projectId]
  );

  const isTodosFocused = focusedBlock === "todos";
  const isDetailsFocused = focusedBlock === "details";

  const resolvedFullDateLabel = useMemo(
    () =>
      fullDateLabel ??
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    [fullDateLabel]
  );

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }),
    []
  );

  const detailDateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    []
  );

  const sortByCreatedAt = useCallback(
    (a: OptimisticTodo, b: OptimisticTodo) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    []
  );

  const activeTodos = useMemo(
    () => optimisticTodos.filter((todo) => !todo.done).sort(sortByCreatedAt),
    [optimisticTodos, sortByCreatedAt]
  );

  const completedTodos = useMemo(
    () => optimisticTodos.filter((todo) => todo.done).sort(sortByCreatedAt),
    [optimisticTodos, sortByCreatedAt]
  );

  const selectedTodo = useMemo(() => {
    if (selectedTodoId === null) {
      return null;
    }

    const match = optimisticTodos.find((todo) => todo.id === selectedTodoId);
    if (!match || match.done) {
      return null;
    }

    return match;
  }, [optimisticTodos, selectedTodoId]);

  const remaining = activeTodos.length;

  const handleNewTodoChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setNewTodo(event.target.value);
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!isAuthenticated) {
        setAndPropagateError("Please sign in to add todos");
        return;
      }

      const value = newTodo.trim();
      if (!value) {
        return;
      }

      setAndPropagateError(null);
      const tempId = -Math.floor(Math.random() * 1_000_000 + Date.now());
      const now = new Date().toISOString();
      const optimisticTodo: OptimisticTodo = {
        id: tempId,
        text: value,
        description: null,
        content: [],
        done: false,
        user_id: "optimistic",
        project_id: projectId,
        created_at: now,
        updated_at: now,
        optimistic: true,
      };
      setNewTodo("");

      startTransition(async () => {
        updateOptimisticTodos({ type: "create", todo: optimisticTodo });
        const result = await createTodo({
          text: value,
          project_id: projectId,
        });

        if (result.success && result.data) {
          const persisted: OptimisticTodo = {
            ...result.data,
            optimistic: false,
          };
          commitTodos((previous) => [...previous, persisted]);
        } else {
          setAndPropagateError(result.error || "Failed to create todo");
          setNewTodo(value);
        }
      });
    },
    [
      createTodo,
      isAuthenticated,
      newTodo,
      projectId,
      setAndPropagateError,
      startTransition,
      updateOptimisticTodos,
      commitTodos,
    ]
  );

  const handleToggleTodo = useCallback(
    (id: number) => {
      setAndPropagateError(null);
      startTransition(async () => {
        updateOptimisticTodos({ type: "toggle", id });
        const result = await toggleTodo({ id, project_id: projectId });
        if (result.success && result.data) {
          const updated: OptimisticTodo = {
            ...result.data,
            optimistic: false,
          };
          commitTodos((previous) =>
            previous.map((todo) => (todo.id === id ? updated : todo))
          );
        } else {
          setAndPropagateError(result.error || "Failed to toggle todo");
        }
      });
    },
    [
      toggleTodo,
      projectId,
      startTransition,
      updateOptimisticTodos,
      setAndPropagateError,
      commitTodos,
    ]
  );

  const handleRemoveTodo = useCallback(
    (id: number) => {
      setAndPropagateError(null);
      startTransition(async () => {
        updateOptimisticTodos({ type: "delete", id });
        const result = await deleteTodo({ id, project_id: projectId });
        if (result.success) {
          commitTodos((previous) => previous.filter((todo) => todo.id !== id));
        } else {
          setAndPropagateError(result.error || "Failed to delete todo");
        }
      });
    },
    [
      deleteTodo,
      projectId,
      startTransition,
      updateOptimisticTodos,
      setAndPropagateError,
      commitTodos,
    ]
  );

  const handleClearCompleted = useCallback(() => {
    setAndPropagateError(null);
    startTransition(async () => {
      updateOptimisticTodos({ type: "clearCompleted" });
      const result = await clearCompletedTodos({ project_id: projectId });
      if (result.success) {
        commitTodos((previous) => previous.filter((todo) => !todo.done));
      } else {
        setAndPropagateError(
          result.error || "Failed to clear completed todos"
        );
      }
    });
  }, [
    clearCompletedTodos,
    projectId,
    startTransition,
    updateOptimisticTodos,
    setAndPropagateError,
    commitTodos,
  ]);

  const handleUpdateContent = useCallback(
    (id: number, nextContent: PartialBlock[]): Promise<boolean> => {
      if (!isAuthenticated) {
        setAndPropagateError("Please sign in to update content");
        return Promise.resolve(false);
      }

      const snapshot =
        typeof structuredClone === "function"
          ? structuredClone(nextContent ?? [])
          : (JSON.parse(
              JSON.stringify(nextContent ?? [])
            ) as PartialBlock[]);

      setAndPropagateError(null);
      return new Promise<boolean>((resolve) => {
        startTransition(async () => {
          let didSucceed = false;
          try {
            updateOptimisticTodos({
              type: "updateContent",
              id,
              content: snapshot,
            });

            const result = await updateTodoContent({
              id,
              content: snapshot,
              project_id: projectId,
            });

            if (result.success && result.data) {
              const updated: OptimisticTodo = {
                ...result.data,
                optimistic: false,
              };
              commitTodos((previous) =>
                previous.map((todo) => (todo.id === id ? updated : todo))
              );
              didSucceed = true;
            } else {
              setAndPropagateError(
                result.error || "Failed to update todo content"
              );
            }
          } catch (error) {
            console.error("Unexpected error updating todo content:", error);
            setAndPropagateError("An unexpected error occurred");
          } finally {
            resolve(didSucceed);
          }
        });
      });
    },
    [
      isAuthenticated,
      setAndPropagateError,
      startTransition,
      updateOptimisticTodos,
      updateTodoContent,
      projectId,
      commitTodos,
    ]
  );

  const handleUpdateText = useCallback(
    (id: number, nextText: string): Promise<boolean> => {
      if (!isAuthenticated) {
        setAndPropagateError("Please sign in to update todo title");
        return Promise.resolve(false);
      }

      const trimmed = nextText.trim();
      if (trimmed.length === 0) {
        setAndPropagateError("Todo text cannot be empty");
        return Promise.resolve(false);
      }

      setAndPropagateError(null);
      return new Promise<boolean>((resolve) => {
        startTransition(async () => {
          let didSucceed = false;
          try {
            updateOptimisticTodos({ type: "updateText", id, text: trimmed });

            const result = await updateTodoText({
              id,
              text: trimmed,
              project_id: projectId,
            });

            if (result.success && result.data) {
              const updated: OptimisticTodo = {
                ...result.data,
                optimistic: false,
              };
              commitTodos((previous) =>
                previous.map((todo) => (todo.id === id ? updated : todo))
              );
              didSucceed = true;
            } else {
              setAndPropagateError(result.error || "Failed to update todo");
            }
          } catch (error) {
            console.error("Unexpected error updating todo title:", error);
            setAndPropagateError("An unexpected error occurred");
          } finally {
            resolve(didSucceed);
          }
        });
      });
    },
    [
      isAuthenticated,
      setAndPropagateError,
      startTransition,
      updateOptimisticTodos,
      updateTodoText,
      projectId,
      commitTodos,
    ]
  );

  const handleActivateTodos = useCallback(() => {
    onActivateBlock?.(projectId, "todos");
  }, [onActivateBlock, projectId]);

  const handleActivateDetails = useCallback(() => {
    onActivateBlock?.(projectId, "details");
  }, [onActivateBlock, projectId]);

  const handleToggleFocus = useCallback(
    (block: FocusableBlock) => {
      const layout = block === "todos" ? todosLayout : detailsLayout;
      const isFocused =
        (block === "todos" && isTodosFocused) ||
        (block === "details" && isDetailsFocused);

      if (isFocused) {
        const storedLayout = previousLayoutsRef.current[block];
        if (storedLayout) {
          onUpdateLayout(projectId, block, { ...storedLayout });
        }
        previousLayoutsRef.current[block] = undefined;
        onFocusChange?.(projectId, null);
        return;
      }

      previousLayoutsRef.current[block] = { ...layout };
      const canvasRect = getCanvasBounds?.() ?? null;
      const focusLayout = computeFocusLayout(layout, canvasRect);
      onUpdateLayout(projectId, block, focusLayout);
      onActivateBlock?.(projectId, block);
      onFocusChange?.(projectId, block);
    },
    [
      detailsLayout,
      getCanvasBounds,
      isDetailsFocused,
      isTodosFocused,
      onActivateBlock,
      onFocusChange,
      onUpdateLayout,
      projectId,
      todosLayout,
    ]
  );

  const handleCloseDetails = useCallback(() => {
    onSelectedTodoChange(projectId, null);
    if (focusedBlock === "details") {
      onFocusChange?.(projectId, null);
    }
  }, [focusedBlock, onFocusChange, onSelectedTodoChange, projectId]);

  const handleSelectTodo = useCallback(
    (todo: OptimisticTodo) => {
      if (todo.done) {
        return;
      }

      const canvasRect = getCanvasBounds?.() ?? null;
      const placement = computeDetailBlockPlacement(
        todosLayout,
        detailsLayout,
        canvasRect
      );

      onUpdateLayout(projectId, "details", {
        ...placement,
      });
      onActivateBlock?.(projectId, "details");
      onFocusChange?.(projectId, "details");
      onSelectedTodoChange(projectId, todo.id);
    },
    [
      detailsLayout,
      getCanvasBounds,
      onActivateBlock,
      onFocusChange,
      onSelectedTodoChange,
      onUpdateLayout,
      projectId,
      todosLayout,
    ]
  );

  const handleTodosDragStop = useCallback<RndDragCallback>(
    (_event, data) => {
      onUpdateLayout(projectId, "todos", { x: data.x, y: data.y });
    },
    [onUpdateLayout, projectId]
  );

  const handleDetailsDragStop = useCallback<RndDragCallback>(
    (_event, data) => {
      onUpdateLayout(projectId, "details", { x: data.x, y: data.y });
    },
    [onUpdateLayout, projectId]
  );

  const handleTodosResizeStop = useCallback<RndResizeCallback>(
    (_event, _direction, elementRef, _delta, position) => {
      onUpdateLayout(projectId, "todos", {
        width: elementRef.offsetWidth,
        height: elementRef.offsetHeight,
        x: position.x,
        y: position.y,
      });
    },
    [onUpdateLayout, projectId]
  );

  const handleDetailsResizeStop = useCallback<RndResizeCallback>(
    (_event, _direction, elementRef, _delta, position) => {
      onUpdateLayout(projectId, "details", {
        width: elementRef.offsetWidth,
        height: elementRef.offsetHeight,
        x: position.x,
        y: position.y,
      });
    },
    [onUpdateLayout, projectId]
  );

  const renderTodo = useCallback(
    (todo: OptimisticTodo): ReactNode => {
      const isCompleted = todo.done;
      const isDisabled = isPending || todo.optimistic;
      const isSelected = selectedTodo?.id === todo.id;
      const createdAt = new Date(todo.created_at);
      const createdOn = Number.isNaN(createdAt.getTime())
        ? null
        : dayFormatter.format(createdAt);

      const containerClasses = ["todo-item", "group"];
      if (todo.optimistic) {
        containerClasses.push("todo-item--optimistic");
      }
      if (!isCompleted) {
        containerClasses.push("todo-item--selectable");
      }
      if (isSelected) {
        containerClasses.push("todo-item--selected");
      }

      const bodyClasses = ["flex", "flex-1", "flex-col", "gap-1"];
      if (!isCompleted) {
        bodyClasses.push("todo-item__body");
      }

      const handleViewDetails = () => {
        if (!isCompleted) {
          handleSelectTodo(todo);
        }
      };

      const handleViewDetailsKeyDown = (
        event: KeyboardEvent<HTMLDivElement>
      ) => {
        if (!isCompleted && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          handleViewDetails();
        }
      };

      return (
        <div key={todo.id} className={containerClasses.join(" ")}>
          <button
            type="button"
            onClick={() => handleToggleTodo(todo.id)}
            className={`todo-checkbox ${
              isCompleted ? "todo-checkbox--checked" : ""
            }`}
            aria-pressed={isCompleted}
            aria-label={
              isCompleted
                ? `Mark todo as active in ${projectLabel}`
                : `Mark todo as done in ${projectLabel}`
            }
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

          <div
            className={bodyClasses.join(" ")}
            {...(!isCompleted
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: handleViewDetails,
                  onKeyDown: handleViewDetailsKeyDown,
                  "aria-pressed": isSelected,
                  "aria-label": `View details for ${todo.text} in ${projectLabel}`,
                }
              : undefined)}
          >
            <p
              className={`todo-text ${
                isCompleted ? "todo-text--completed" : ""
              }`}
            >
              {todo.text}
            </p>
            {createdOn && <span className="todo-meta">Added {createdOn}</span>}
          </div>

          <button
            type="button"
            onClick={() => handleRemoveTodo(todo.id)}
            className="todo-action"
            disabled={isDisabled}
            aria-label={`Delete todo from ${projectLabel}`}
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
    },
    [
      dayFormatter,
      handleRemoveTodo,
      handleSelectTodo,
      handleToggleTodo,
      isPending,
      projectLabel,
      selectedTodo,
    ]
  );

  const detailCreatedAt = selectedTodo
    ? new Date(selectedTodo.created_at)
    : null;
  const detailUpdatedAt = selectedTodo
    ? new Date(selectedTodo.updated_at)
    : null;
  const detailCreatedLabel =
    detailCreatedAt && !Number.isNaN(detailCreatedAt.getTime())
      ? detailDateTimeFormatter.format(detailCreatedAt)
      : null;
  const detailUpdatedLabel =
    detailUpdatedAt &&
    !Number.isNaN(detailUpdatedAt.getTime()) &&
    detailCreatedAt &&
    detailUpdatedAt.getTime() !== detailCreatedAt.getTime()
      ? detailDateTimeFormatter.format(detailUpdatedAt)
      : null;

  return (
    <>
      <TodosBlock
        layout={todosLayout}
        isFocused={isTodosFocused}
        onToggleFocus={() => handleToggleFocus("todos")}
        onActivate={handleActivateTodos}
        onDragStop={handleTodosDragStop}
        onResizeStop={handleTodosResizeStop}
        remainingCount={remaining}
        fullDateLabel={resolvedFullDateLabel}
        isAuthenticated={isAuthenticated}
        isSignOutPending={isSignOutPending}
        onSignOut={onSignOut}
        onSubmit={handleSubmit}
        newTodoValue={newTodo}
        onNewTodoChange={handleNewTodoChange}
        isPending={isPending}
        isLoading={isLoading}
        error={error}
        activeTodos={activeTodos}
        completedTodos={completedTodos}
        renderTodo={renderTodo}
        showCompleted={showCompleted}
        onToggleShowCompleted={() =>
          setShowCompleted((previous) => !previous)
        }
        onClearCompleted={handleClearCompleted}
      />
      <TodoDetailsBlock
        layout={detailsLayout}
        selectedTodo={selectedTodo}
        isFocused={isDetailsFocused}
        onToggleFocus={() => handleToggleFocus("details")}
        onActivate={handleActivateDetails}
        onClose={handleCloseDetails}
        onDragStop={handleDetailsDragStop}
        onResizeStop={handleDetailsResizeStop}
        createdLabel={detailCreatedLabel}
        updatedLabel={detailUpdatedLabel}
        onUpdateContent={handleUpdateContent}
        onUpdateText={handleUpdateText}
      />
    </>
  );
}
