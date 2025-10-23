import type { Todo } from "@/types/database";

export type OptimisticTodo = Todo & { optimistic?: boolean };
