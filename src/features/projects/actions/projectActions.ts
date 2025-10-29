"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { createClient } from "@/utils/supabase/server";
import type {
  ActionResponse,
  Project,
  ProjectInsert,
  ProjectUpdate,
} from "@/types/database";
import {
  createProjectSchema,
  deleteProjectSchema,
  getProjectsSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type DeleteProjectInput,
  type GetProjectsInput,
  type UpdateProjectInput,
} from "../schemas/projectSchemas";

type CreateProjectParams = Omit<CreateProjectInput, "owner_id">;

function getZodErrorMessage(error: ZodError<unknown>) {
  return error.issues[0]?.message ?? "Validation failed";
}

function normalizeProjectRecord(record: Record<string, unknown>): Project {
  const row = record as {
    id: number;
    name: string;
    description?: string | null;
    owner_id: string;
    metadata?: unknown;
    created_at: string;
    updated_at: string;
  };

  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    owner_id: row.owner_id,
    metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: "You must be logged in to perform this action",
    };
  }

  return { user, error: null };
}

export async function getProjects(): Promise<ActionResponse<Project[]>> {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    // Validate owner id for consistency with schema expectations
    getProjectsSchema.parse({ owner_id: user.id } satisfies GetProjectsInput);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching projects:", error);
      return { success: false, error: "Failed to fetch projects" };
    }

    const projects = (data ?? []).map((record) =>
      normalizeProjectRecord(record)
    );
    return { success: true, data: projects };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in getProjects:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function createProject(
  input: CreateProjectParams
): Promise<ActionResponse<Project>> {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const validatedInput = createProjectSchema.parse({
      ...input,
      owner_id: user.id,
    } satisfies CreateProjectInput);

    const supabase = await createClient();

    const payload: ProjectInsert = {
      name: validatedInput.name,
      description: validatedInput.description ?? null,
      owner_id: validatedInput.owner_id,
      metadata: {},
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error creating project:", error);
      return { success: false, error: "Failed to create project" };
    }

    if (!data) {
      return { success: false, error: "Failed to create project" };
    }

    revalidatePath("/");
    return { success: true, data: normalizeProjectRecord(data) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in createProject:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function updateProject(
  input: UpdateProjectInput
): Promise<ActionResponse<Project>> {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const validatedInput = updateProjectSchema.parse(input);

    const supabase = await createClient();

    const updates: ProjectUpdate = {
      id: validatedInput.id,
    };

    if (validatedInput.name !== undefined) {
      updates.name = validatedInput.name;
    }
    if (validatedInput.description !== undefined) {
      updates.description = validatedInput.description ?? null;
    }

    const { data, error } = await supabase
      .from("projects")
      .update({
        name: updates.name,
        description: updates.description,
      })
      .eq("id", updates.id)
      .eq("owner_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating project:", error);
      return { success: false, error: "Failed to update project" };
    }

    if (!data) {
      return { success: false, error: "Project not found or access denied" };
    }

    revalidatePath("/");
    return { success: true, data: normalizeProjectRecord(data) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in updateProject:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function deleteProject(
  input: DeleteProjectInput
): Promise<ActionResponse<void>> {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError || !user) {
      return { success: false, error: authError };
    }

    const validatedInput = deleteProjectSchema.parse(input);

    const supabase = await createClient();

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", validatedInput.id)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Error deleting project:", error);
      return { success: false, error: "Failed to delete project" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: getZodErrorMessage(error) };
    }
    console.error("Unexpected error in deleteProject:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
