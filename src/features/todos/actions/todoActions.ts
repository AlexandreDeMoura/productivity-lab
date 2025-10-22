"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { ActionResponse, Todo } from "@/types/database";
import {
  createTodoSchema,
  updateTodoSchema,
  toggleTodoSchema,
  deleteTodoSchema,
  getTodosSchema,
  type CreateTodoInput,
  type UpdateTodoInput,
  type ToggleTodoInput,
  type DeleteTodoInput,
  type GetTodosInput,
} from "../schemas/todoSchemas";
import { ZodError } from "zod";

function getZodErrorMessage(error: ZodError<unknown>) {
  return error.issues[0]?.message ?? "Validation failed";
}

// Helper function to get authenticated user
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "You must be logged in to perform this action" };
  }

  return { user, error: null };
}

// Get all todos for the current user
export async function getTodos(
  input?: GetTodosInput
): Promise<ActionResponse<Todo[]>> {
  try {
    const supabase = await createClient();

    // Validate input
    const validatedInput = getTodosSchema.parse(input || {});

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "You must be logged in to view todos" };
    }

    // Build query
    let query = supabase
      .from("todos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Apply filter
    if (validatedInput.filter === "active") {
      query = query.eq("done", false);
    } else if (validatedInput.filter === "completed") {
      query = query.eq("done", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching todos:", error);
      return { success: false, error: "Failed to fetch todos" };
    }

    return { success: true, data: data as Todo[] };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in getTodos:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Create a new todo
export async function createTodo(
  input: CreateTodoInput
): Promise<ActionResponse<Todo>> {
  try {
    // Validate input
    const validatedInput = createTodoSchema.parse(input);

    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();

    // Insert todo
    const { data, error } = await supabase
      .from("todos")
      .insert({
        text: validatedInput.text,
        user_id: user.id,
        done: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating todo:", error);
      return { success: false, error: "Failed to create todo" };
    }

    revalidatePath("/");
    return { success: true, data: data as Todo };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in createTodo:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Update a todo
export async function updateTodo(
  input: UpdateTodoInput
): Promise<ActionResponse<Todo>> {
  try {
    // Validate input
    const validatedInput = updateTodoSchema.parse(input);

    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();

    // Build update object
    const updates: { text?: string; done?: boolean } = {};
    if (validatedInput.text !== undefined) {
      updates.text = validatedInput.text;
    }
    if (validatedInput.done !== undefined) {
      updates.done = validatedInput.done;
    }

    // Update todo (RLS ensures user can only update their own todos)
    const { data, error } = await supabase
      .from("todos")
      .update(updates)
      .eq("id", validatedInput.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating todo:", error);
      return { success: false, error: "Failed to update todo" };
    }

    if (!data) {
      return { success: false, error: "Todo not found or access denied" };
    }

    revalidatePath("/");
    return { success: true, data: data as Todo };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in updateTodo:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Toggle todo completion status
export async function toggleTodo(
  input: ToggleTodoInput
): Promise<ActionResponse<Todo>> {
  try {
    // Validate input
    const validatedInput = toggleTodoSchema.parse(input);

    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();

    // First, get the current todo to know its current state
    const { data: currentTodo, error: fetchError } = await supabase
      .from("todos")
      .select("done")
      .eq("id", validatedInput.id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !currentTodo) {
      return { success: false, error: "Todo not found or access denied" };
    }

    // Toggle the done status
    const { data, error } = await supabase
      .from("todos")
      .update({ done: !currentTodo.done })
      .eq("id", validatedInput.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error toggling todo:", error);
      return { success: false, error: "Failed to toggle todo" };
    }

    revalidatePath("/");
    return { success: true, data: data as Todo };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in toggleTodo:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Delete a todo
export async function deleteTodo(
  input: DeleteTodoInput
): Promise<ActionResponse<void>> {
  try {
    // Validate input
    const validatedInput = deleteTodoSchema.parse(input);

    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();

    // Delete todo (RLS ensures user can only delete their own todos)
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("id", validatedInput.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting todo:", error);
      return { success: false, error: "Failed to delete todo" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in deleteTodo:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Clear all completed todos
export async function clearCompletedTodos(): Promise<ActionResponse<void>> {
  try {
    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();

    // Delete all completed todos for the user
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("user_id", user.id)
      .eq("done", true);

    if (error) {
      console.error("Error clearing completed todos:", error);
      return { success: false, error: "Failed to clear completed todos" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Unexpected error in clearCompletedTodos:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
