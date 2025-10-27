import type { PartialBlock } from "@blocknote/core";

// Database types based on the todos table schema
export type Todo = {
  id: number;
  text: string;
  description: string | null;
  content: PartialBlock[];
  done: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type TodoInsert = {
  text: string;
  description?: string | null;
  content?: PartialBlock[];
  user_id: string;
  done?: boolean;
};

export type TodoUpdate = {
  text?: string;
  description?: string | null;
  content?: PartialBlock[];
  done?: boolean;
};

// Server action response type
export type ActionResponse<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};
