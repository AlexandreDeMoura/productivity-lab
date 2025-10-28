"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { ActionResponse, Todo } from "@/types/database";
import {
  createTodoSchema,
  updateTodoSchema,
  updateTodoDescriptionSchema,
  updateTodoTextSchema,
  updateTodoContentSchema,
  toggleTodoSchema,
  deleteTodoSchema,
  getTodosSchema,
  type CreateTodoInput,
  type UpdateTodoInput,
  type UpdateTodoDescriptionInput,
  type UpdateTodoTextInput,
  type UpdateTodoContentInput,
  type ToggleTodoInput,
  type DeleteTodoInput,
  type GetTodosInput,
} from "../schemas/todoSchemas";
import { ZodError } from "zod";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

class ProjectResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectResolutionError";
  }
}

type CreateTodoActionInput = Omit<CreateTodoInput, "project_id"> & {
  project_id?: number;
};

type GetTodosActionInput = Partial<GetTodosInput> & {
  project_id?: number;
};

type ClearCompletedTodosInput = {
  project_id?: number;
};

function getZodErrorMessage(error: ZodError<unknown>) {
  return error.issues[0]?.message ?? "Validation failed";
}

function normalizeDescription(description?: string | null) {
  if (description === undefined || description === null) {
    return null;
  }

  const value = description.trim();
  return value.length === 0 ? null : value;
}

function normalizeContent(content: unknown): Todo["content"] {
  if (!Array.isArray(content)) {
    return [];
  }

  try {
    return JSON.parse(JSON.stringify(content)) as Todo["content"];
  } catch {
    return [];
  }
}

function normalizeTodoRecord(record: Record<string, unknown>): Todo {
  const row = record as {
    id: number;
    text: string;
    description?: string | null;
    content?: unknown;
    done: boolean;
    user_id: string;
    project_id: number;
    created_at: string;
    updated_at: string;
  };

  return {
    id: row.id,
    text: row.text,
    description: row.description ?? null,
    content: normalizeContent(row.content),
    done: row.done,
    user_id: row.user_id,
    project_id: row.project_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function resolveProjectId(
  supabase: SupabaseServerClient,
  userId: string,
  providedProjectId?: number
): Promise<number> {
  if (typeof providedProjectId === "number" && Number.isFinite(providedProjectId)) {
    return providedProjectId;
  }

  const {
    data: todoProjects,
    error: todoProjectError,
  } = await supabase
    .from("todos")
    .select("project_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (todoProjectError) {
    console.error("Error resolving project from todos:", todoProjectError);
    throw new ProjectResolutionError("Failed to resolve default project");
  }

  const todoProjectId = todoProjects?.[0]?.project_id;
  if (typeof todoProjectId === "number" && Number.isFinite(todoProjectId)) {
    return todoProjectId;
  }

  const {
    data: ownedProjects,
    error: ownedError,
  } = await supabase
    .from("projects")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (ownedError) {
    if (ownedError.code !== "42P17") {
      console.error("Error resolving owned project:", ownedError);
      throw new ProjectResolutionError("Failed to resolve default project");
    }
  } else {
    const ownedProjectId = ownedProjects?.[0]?.id;
    if (typeof ownedProjectId === "number" && Number.isFinite(ownedProjectId)) {
      return ownedProjectId;
    }
  }

  const { data: memberProjects, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (memberError) {
    if (memberError.code !== "42P17") {
      console.error("Error resolving member project:", memberError);
      throw new ProjectResolutionError("Failed to resolve default project");
    }
  } else {
    const memberProjectId = memberProjects?.[0]?.project_id;
    if (
      typeof memberProjectId === "number" &&
      Number.isFinite(memberProjectId)
    ) {
      return memberProjectId;
    }
  }

  throw new ProjectResolutionError(
    "No accessible project found. Create or join a project to continue."
  );
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
  input?: GetTodosActionInput
): Promise<ActionResponse<Todo[]>> {
  try {
    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();

    const projectId = await resolveProjectId(
      supabase,
      user.id,
      input?.project_id
    );

    // Validate input
    const validatedInput = getTodosSchema.parse({
      ...input,
      project_id: projectId,
    } satisfies GetTodosInput);

    // Build query
    let query = supabase
      .from("todos")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", validatedInput.project_id)
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

    const todos = (data ?? []).map((record) => normalizeTodoRecord(record));
    return { success: true, data: todos };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    if (error instanceof ProjectResolutionError) {
      return { success: false, error: error.message };
    }
    console.error("Unexpected error in getTodos:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// Create a new todo
export async function createTodo(
  input: CreateTodoActionInput
): Promise<ActionResponse<Todo>> {
  try {
    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();
    const projectId = await resolveProjectId(
      supabase,
      user.id,
      input.project_id
    );

    // Validate input
    const validatedInput = createTodoSchema.parse({
      ...input,
      project_id: projectId,
    } satisfies CreateTodoInput);
    const description = normalizeDescription(validatedInput.description);
    const content = Array.isArray(validatedInput.content)
      ? (validatedInput.content as Todo["content"])
      : [];

    // Insert todo
    const { data, error } = await supabase
      .from("todos")
      .insert({
        text: validatedInput.text,
        description,
        content,
        user_id: user.id,
        project_id: validatedInput.project_id,
        done: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating todo:", error);
      return { success: false, error: "Failed to create todo" };
    }

    if (!data) {
      return { success: false, error: "Failed to create todo" };
    }

    revalidatePath("/");
    return { success: true, data: normalizeTodoRecord(data) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    if (error instanceof ProjectResolutionError) {
      return { success: false, error: error.message };
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
    const updates: {
      text?: string;
      done?: boolean;
      description?: string | null;
      content?: Todo["content"];
    } = {};
    if (validatedInput.text !== undefined) {
      updates.text = validatedInput.text;
    }
    if (validatedInput.done !== undefined) {
      updates.done = validatedInput.done;
    }
    if (validatedInput.description !== undefined) {
      updates.description = normalizeDescription(validatedInput.description);
    }
    if (validatedInput.content !== undefined) {
      updates.content = Array.isArray(validatedInput.content)
        ? (validatedInput.content as Todo["content"])
        : [];
    }

    // Update todo (RLS ensures user can only update their own todos)
    let query = supabase
      .from("todos")
      .update(updates)
      .eq("id", validatedInput.id)
      .eq("user_id", user.id);

    if (validatedInput.project_id !== undefined) {
      query = query.eq("project_id", validatedInput.project_id);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Error updating todo:", error);
      return { success: false, error: "Failed to update todo" };
    }

    if (!data) {
      return { success: false, error: "Todo not found or access denied" };
    }

    revalidatePath("/");
    return { success: true, data: normalizeTodoRecord(data) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in updateTodo:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateTodoDescription(
  input: UpdateTodoDescriptionInput
): Promise<ActionResponse<Todo>> {
  try {
    const validatedInput = updateTodoDescriptionSchema.parse(input);

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();
    const description = normalizeDescription(validatedInput.description);

    let query = supabase
      .from("todos")
      .update({ description })
      .eq("id", validatedInput.id)
      .eq("user_id", user.id);

    if (validatedInput.project_id !== undefined) {
      query = query.eq("project_id", validatedInput.project_id);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Error updating todo description:", error);
      return { success: false, error: "Failed to update description" };
    }

    if (!data) {
      return { success: false, error: "Todo not found or access denied" };
    }

    revalidatePath("/");
    return { success: true, data: normalizeTodoRecord(data) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in updateTodoDescription:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateTodoText(
  input: UpdateTodoTextInput
): Promise<ActionResponse<Todo>> {
  try {
    const validatedInput = updateTodoTextSchema.parse(input);

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();

    let query = supabase
      .from("todos")
      .update({ text: validatedInput.text })
      .eq("id", validatedInput.id)
      .eq("user_id", user.id);

    if (validatedInput.project_id !== undefined) {
      query = query.eq("project_id", validatedInput.project_id);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Error updating todo text:", error);
      return { success: false, error: "Failed to update todo" };
    }

    if (!data) {
      return { success: false, error: "Todo not found or access denied" };
    }

    revalidatePath("/");
    return { success: true, data: normalizeTodoRecord(data) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in updateTodoText:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateTodoContent(
  input: UpdateTodoContentInput
): Promise<ActionResponse<Todo>> {
  try {
    const validatedInput = updateTodoContentSchema.parse(input);

    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();
    const content = Array.isArray(validatedInput.content)
      ? (validatedInput.content as Todo["content"])
      : [];

    let query = supabase
      .from("todos")
      .update({ content })
      .eq("id", validatedInput.id)
      .eq("user_id", user.id);

    if (validatedInput.project_id !== undefined) {
      query = query.eq("project_id", validatedInput.project_id);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Error updating todo content:", error);
      return { success: false, error: "Failed to update todo content" };
    }

    if (!data) {
      return { success: false, error: "Todo not found or access denied" };
    }

    revalidatePath("/");
    return { success: true, data: normalizeTodoRecord(data) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in updateTodoContent:", error);
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
    let currentQuery = supabase
      .from("todos")
      .select("done")
      .eq("id", validatedInput.id)
      .eq("user_id", user.id);

    if (validatedInput.project_id !== undefined) {
      currentQuery = currentQuery.eq(
        "project_id",
        validatedInput.project_id
      );
    }

    const { data: currentTodo, error: fetchError } = await currentQuery.single();

    if (fetchError || !currentTodo) {
      return { success: false, error: "Todo not found or access denied" };
    }

    // Toggle the done status
    let toggleQuery = supabase
      .from("todos")
      .update({ done: !currentTodo.done })
      .eq("id", validatedInput.id)
      .eq("user_id", user.id);

    if (validatedInput.project_id !== undefined) {
      toggleQuery = toggleQuery.eq("project_id", validatedInput.project_id);
    }

    const { data, error } = await toggleQuery.select().single();

    if (error) {
      console.error("Error toggling todo:", error);
      return { success: false, error: "Failed to toggle todo" };
    }

    revalidatePath("/");
    return { success: true, data: normalizeTodoRecord(data) };
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
    let query = supabase
      .from("todos")
      .delete()
      .eq("id", validatedInput.id)
      .eq("user_id", user.id);

    if (validatedInput.project_id !== undefined) {
      query = query.eq("project_id", validatedInput.project_id);
    }

    const { error } = await query;

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
export async function clearCompletedTodos(
  input?: ClearCompletedTodosInput
): Promise<ActionResponse<void>> {
  try {
    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const supabase = await createClient();
    const projectId = await resolveProjectId(
      supabase,
      user.id,
      input?.project_id
    );

    // Delete all completed todos for the user
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .eq("done", true);

    if (error) {
      console.error("Error clearing completed todos:", error);
      return { success: false, error: "Failed to clear completed todos" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    if (error instanceof ProjectResolutionError) {
      return { success: false, error: error.message };
    }
    console.error("Unexpected error in clearCompletedTodos:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
