import { z } from "zod";

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name cannot be empty")
    .max(100, "Project name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
  owner_id: z.string().uuid("Invalid owner ID"),
});

export const updateProjectSchema = z
  .object({
    id: z.number().int().positive("Invalid project ID"),
    name: z
      .string()
      .trim()
      .min(1, "Project name cannot be empty")
      .max(100, "Project name cannot exceed 100 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .optional()
      .nullable(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.description !== undefined,
    {
      message: "At least one field (name or description) must be provided",
      path: ["name"],
    }
  );

export const deleteProjectSchema = z.object({
  id: z.number().int().positive("Invalid project ID"),
});

export const getProjectsSchema = z.object({
  owner_id: z.string().uuid("Invalid owner ID"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;
export type GetProjectsInput = z.infer<typeof getProjectsSchema>;
