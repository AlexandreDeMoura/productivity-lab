'use client';

import {
  FormEvent,
  KeyboardEvent,
  useState,
  useEffect,
  useTransition,
  useOptimistic,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
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

type BlockId = "todos" | "todoDetails";

type BlockLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};

type BlockLayouts = Record<BlockId, BlockLayout>;
type BlockRect = Pick<BlockLayout, "x" | "y" | "width" | "height">;

const STORAGE_KEY = "workspace.layouts.v1";
const BLOCK_IDS: BlockId[] = ["todos", "todoDetails"];

const createDefaultLayouts = (): BlockLayouts => {
  const todosLayout: BlockLayout = {
    x: 48,
    y: 48,
    width: 520,
    height: 660,
    z: 1,
  };

  const detailLayout: BlockLayout = {
    x: todosLayout.x + todosLayout.width + 32,
    y: todosLayout.y,
    width: 420,
    height: 520,
    z: 2,
  };

  return {
    todos: todosLayout,
    todoDetails: detailLayout,
  };
};

const sanitizeLayout = (
  layout: Partial<BlockLayout> | undefined,
  fallback: BlockLayout
): BlockLayout => ({
  x: typeof layout?.x === "number" ? layout.x : fallback.x,
  y: typeof layout?.y === "number" ? layout.y : fallback.y,
  width: typeof layout?.width === "number" ? layout.width : fallback.width,
  height: typeof layout?.height === "number" ? layout.height : fallback.height,
  z: typeof layout?.z === "number" ? layout.z : fallback.z,
});

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
    typeof window !== "undefined" ? window.innerWidth : todosLayout.x + todosLayout.width + gap;
  const fallbackHeight =
    typeof window !== "undefined" ? window.innerHeight : todosLayout.y + todosLayout.height + gap;

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

  const attempts = [attemptRight, attemptLeft, attemptBelow, attemptAbove];

  for (const attempt of attempts) {
    const placement = attempt();
    if (placement) {
      return placement;
    }
  }

  const fallbackWidthClamped = clamp(
    preferredWidth,
    effectiveMinWidth,
    Math.max(effectiveMinWidth, containerWidth - padding * 2)
  );
  const fallbackHeightClamped = clamp(
    preferredHeight,
    effectiveMinHeight,
    Math.max(effectiveMinHeight, containerHeight - padding * 2)
  );

  return {
    x: clamp((containerWidth - fallbackWidthClamped) / 2, padding, Math.max(padding, containerWidth - fallbackWidthClamped - padding)),
    y: clamp((containerHeight - fallbackHeightClamped) / 2, padding, Math.max(padding, containerHeight - fallbackHeightClamped - padding)),
    width: fallbackWidthClamped,
    height: fallbackHeightClamped,
  };
};

const computeFocusLayout = (layout: BlockLayout, canvasRect?: DOMRect | null): BlockLayout => {
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

const loadLayouts = (): BlockLayouts => {
  const defaults = createDefaultLayouts();

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<Record<BlockId, Partial<BlockLayout>>>;
    const result: BlockLayouts = { ...defaults };

    for (const blockId of BLOCK_IDS) {
      result[blockId] = sanitizeLayout(parsed?.[blockId], defaults[blockId]);
    }

    return result;
  } catch {
    return defaults;
  }
};

const getNextZ = (layouts: BlockLayouts) =>
  Object.values(layouts).reduce((highest, current) => Math.max(highest, current.z), 0) + 1;

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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const previousLayoutsRef = useRef<Partial<Record<BlockId, BlockLayout>>>({});
  const [blockLayouts, setBlockLayouts] = useState<BlockLayouts>(() => loadLayouts());
  const [focusedBlockId, setFocusedBlockId] = useState<BlockId | null>(null);
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const todoLayout = blockLayouts.todos;
  const detailLayout = blockLayouts.todoDetails;
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
  const isDetailVisible = Boolean(selectedTodo);

  const updateLayout = useCallback(
    (id: BlockId, next: Partial<BlockLayout>) => {
      setBlockLayouts((previous) => {
        const layout = previous[id];
        if (!layout) {
          return previous;
        }

        return {
          ...previous,
          [id]: {
            ...layout,
            ...next,
            z: getNextZ(previous),
          },
        };
      });
    },
    []
  );

  const raiseBlock = useCallback((id: BlockId) => {
    setBlockLayouts((previous) => {
      const layout = previous[id];
      if (!layout) {
        return previous;
      }

      const highest = Object.values(previous).reduce(
        (maxValue, current) => Math.max(maxValue, current.z),
        0
      );

      if (layout.z === highest) {
        return previous;
      }

      return {
        ...previous,
        [id]: {
          ...layout,
          z: highest + 1,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (selectedTodoId !== null && !selectedTodo) {
      setSelectedTodoId(null);
    }
  }, [selectedTodo, selectedTodoId]);

  useEffect(() => {
    if (!isDetailVisible) {
      return;
    }

    setBlockLayouts((previous) => {
      const detail = previous.todoDetails;
      if (!detail) {
        return previous;
      }

      const canvasRect = canvasRef.current?.getBoundingClientRect() ?? null;
      const placement = computeDetailBlockPlacement(previous.todos, detail, canvasRect);

      if (
        detail.x === placement.x &&
        detail.y === placement.y &&
        detail.width === placement.width &&
        detail.height === placement.height
      ) {
        return previous;
      }

      return {
        ...previous,
        todoDetails: {
          ...detail,
          ...placement,
        },
      };
    });
  }, [
    isDetailVisible,
    todoLayout.height,
    todoLayout.width,
    todoLayout.x,
    todoLayout.y,
    setBlockLayouts,
  ]);

  useEffect(() => {
    if (!isDetailVisible || typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setBlockLayouts((previous) => {
        const detail = previous.todoDetails;
        if (!detail) {
          return previous;
        }

        const canvasRect = canvasRef.current?.getBoundingClientRect() ?? null;
        const placement = computeDetailBlockPlacement(previous.todos, detail, canvasRect);

        if (
          detail.x === placement.x &&
          detail.y === placement.y &&
          detail.width === placement.width &&
          detail.height === placement.height
        ) {
          return previous;
        }

        return {
          ...previous,
          todoDetails: {
            ...detail,
            ...placement,
          },
        };
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isDetailVisible, setBlockLayouts]);

  const handleTodosDragStop = useCallback<RndDragCallback>(
    (_event, data) => {
      updateLayout("todos", { x: data.x, y: data.y });
    },
    [updateLayout]
  );

  const handleDetailsDragStop = useCallback<RndDragCallback>(
    (_event, data) => {
      updateLayout("todoDetails", { x: data.x, y: data.y });
    },
    [updateLayout]
  );

  const handleTodosResizeStop = useCallback<RndResizeCallback>(
    (_event, _direction, elementRef, _delta, position) => {
      updateLayout("todos", {
        width: elementRef.offsetWidth,
        height: elementRef.offsetHeight,
        x: position.x,
        y: position.y,
      });
    },
    [updateLayout]
  );

  const handleDetailsResizeStop = useCallback<RndResizeCallback>(
    (_event, _direction, elementRef, _delta, position) => {
      updateLayout("todoDetails", {
        width: elementRef.offsetWidth,
        height: elementRef.offsetHeight,
        x: position.x,
        y: position.y,
      });
    },
    [updateLayout]
  );

  const toggleFocus = useCallback(
    (id: BlockId) => {
      if (focusedBlockId === id) {
        const storedLayout = previousLayoutsRef.current[id];

        setBlockLayouts((previous) => {
          const layout = previous[id];
          if (!layout) {
            return previous;
          }

          const restored = storedLayout ? { ...storedLayout } : layout;
          delete previousLayoutsRef.current[id];

          return {
            ...previous,
            [id]: {
              ...restored,
              z: getNextZ(previous),
            },
          };
        });

        setFocusedBlockId(null);
        return;
      }

      const canvasRect = canvasRef.current?.getBoundingClientRect() ?? null;

      setBlockLayouts((previous) => {
        const layout = previous[id];
        if (!layout) {
          return previous;
        }

        previousLayoutsRef.current[id] = { ...layout };

        const focusedLayout = computeFocusLayout(layout, canvasRect);

        return {
          ...previous,
          [id]: {
            ...focusedLayout,
            z: getNextZ(previous),
          },
        };
      });

      setFocusedBlockId(id);
    },
    [focusedBlockId]
  );

  useEffect(() => {
    if (typeof window === "undefined" || focusedBlockId) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(blockLayouts));
  }, [blockLayouts, focusedBlockId]);

  const isTodoFocused = focusedBlockId === "todos";
  const isDetailFocused = focusedBlockId === "todoDetails";

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

  const detailDateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
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

  const handleSelectTodo = useCallback(
    (todo: OptimisticTodo) => {
      if (todo.done) {
        return;
      }

      const canvasRect = canvasRef.current?.getBoundingClientRect() ?? null;
      setSelectedTodoId(todo.id);
      setBlockLayouts((previous) => {
        const detail = previous.todoDetails;
        const placement = computeDetailBlockPlacement(previous.todos, detail, canvasRect);

        return {
          ...previous,
          todoDetails: {
            ...detail,
            ...placement,
            z: getNextZ(previous),
          },
        };
      });
    },
    []
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedTodoId(null);
    setFocusedBlockId((current) => (current === "todoDetails" ? null : current));
  }, []);

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

    const handleViewDetailsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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

        <div
          className={bodyClasses.join(" ")}
          {...(!isCompleted
            ? {
                role: "button",
                tabIndex: 0,
                onClick: handleViewDetails,
                onKeyDown: handleViewDetailsKeyDown,
                "aria-pressed": isSelected,
                "aria-label": `View details for ${todo.text}`,
              }
            : undefined)}
        >
          <p className={`todo-text ${isCompleted ? "todo-text--completed" : ""}`}>
            {todo.text}
          </p>
          {createdOn && <span className="todo-meta">Added {createdOn}</span>}
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

  const detailCreatedAt = selectedTodo ? new Date(selectedTodo.created_at) : null;
  const detailUpdatedAt = selectedTodo ? new Date(selectedTodo.updated_at) : null;
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
    <main className="workspace-root">
      <div ref={canvasRef} className="workspace-canvas">
        <Rnd
          bounds="parent"
          size={{ width: todoLayout.width, height: todoLayout.height }}
          position={{ x: todoLayout.x, y: todoLayout.y }}
          minWidth={360}
          minHeight={420}
          style={{ zIndex: todoLayout.z }}
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
          onDragStop={handleTodosDragStop}
          onResizeStop={handleTodosResizeStop}
          onMouseDown={() => raiseBlock("todos")}
        >
          <article
            className={`workspace-block ${
              isTodoFocused ? "workspace-block--focused" : ""
            }`}
            onMouseDownCapture={() => raiseBlock("todos")}
          >
            <div className="workspace-block__chrome">
              <div className="workspace-block__drag-region" aria-label="Drag Todos block">
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
                  onClick={() => toggleFocus("todos")}
                  className="workspace-block__action"
                  aria-pressed={isTodoFocused}
                  aria-label={
                    isTodoFocused
                      ? "Exit focus and restore previous size"
                      : "Focus this block"
                  }
                  title={
                    isTodoFocused
                      ? "Exit focus and restore previous size"
                      : "Focus this block"
                  }
                >
                  {isTodoFocused ? "Exit focus" : "Focus"}
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

              <section className="mt-8 space-y-6">
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
          </article>
        </Rnd>
        {selectedTodo && (
          <Rnd
            bounds="parent"
            size={{ width: detailLayout.width, height: detailLayout.height }}
            position={{ x: detailLayout.x, y: detailLayout.y }}
            minWidth={320}
            minHeight={360}
            style={{ zIndex: detailLayout.z }}
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
            onDragStop={handleDetailsDragStop}
            onResizeStop={handleDetailsResizeStop}
            onMouseDown={() => raiseBlock("todoDetails")}
          >
            <article
              className={`workspace-block ${
                isDetailFocused ? "workspace-block--focused" : ""
              }`}
              onMouseDownCapture={() => raiseBlock("todoDetails")}
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
                    onClick={() => toggleFocus("todoDetails")}
                    className="workspace-block__action"
                    aria-pressed={isDetailFocused}
                    aria-label={
                      isDetailFocused
                        ? "Exit focus and restore previous size"
                        : "Focus this block"
                    }
                    title={
                      isDetailFocused
                        ? "Exit focus and restore previous size"
                        : "Focus this block"
                    }
                  >
                    {isDetailFocused ? "Exit focus" : "Focus"}
                  </button>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={handleCloseDetails}
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

                    {detailCreatedLabel && (
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
                          Created
                        </dt>
                        <dd className="text-sm text-foreground">
                          {detailCreatedLabel}
                        </dd>
                      </div>
                    )}

                    {detailUpdatedLabel && (
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
                          Last updated
                        </dt>
                        <dd className="text-sm text-foreground">
                          {detailUpdatedLabel}
                        </dd>
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
        )}
      </div>
    </main>
  );
}
