import { z } from "zod";

const blockNoteContentSchema = z
  .array(
    z
      .object({
        id: z.string().optional(),
        type: z.string().optional(),
        props: z.record(z.unknown()).optional(),
        content: z.unknown().optional(),
        children: z.unknown().optional(),
      })
      .passthrough()
  )
  .default([]);

// Schema for creating a todo
export const createTodoSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Todo text cannot be empty")
    .max(500, "Todo text cannot exceed 500 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .optional()
    .nullable(),
  content: blockNoteContentSchema.optional(),
});

// Schema for updating a todo
export const updateTodoSchema = z.object({
  id: z.number().int().positive("Invalid todo ID"),
  text: z
    .string()
    .trim()
    .min(1, "Todo text cannot be empty")
    .max(500, "Todo text cannot exceed 500 characters")
    .optional(),
  done: z.boolean().optional(),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .optional()
    .nullable(),
  content: blockNoteContentSchema.optional(),
}).refine(
  (data) =>
    data.text !== undefined ||
    data.done !== undefined ||
    data.description !== undefined ||
    data.content !== undefined,
  {
    message:
      "At least one field (text, done, description, or content) must be provided",
  }
);

// Schema specifically for updating the description
export const updateTodoDescriptionSchema = z.object({
  id: z.number().int().positive("Invalid todo ID"),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .nullable(),
});

// Schema specifically for updating the todo text/title
export const updateTodoTextSchema = z.object({
  id: z.number().int().positive("Invalid todo ID"),
  text: z
    .string()
    .trim()
    .min(1, "Todo text cannot be empty")
    .max(500, "Todo text cannot exceed 500 characters"),
});

export const updateTodoContentSchema = z.object({
  id: z.number().int().positive("Invalid todo ID"),
  content: blockNoteContentSchema,
});

// Schema for toggling a todo's completion status
export const toggleTodoSchema = z.object({
  id: z.number().int().positive("Invalid todo ID"),
});

// Schema for deleting a todo
export const deleteTodoSchema = z.object({
  id: z.number().int().positive("Invalid todo ID"),
});

// Schema for filtering todos
export const getTodosSchema = z.object({
  filter: z.enum(["all", "active", "completed"]).optional().default("all"),
});

// Export types inferred from schemas
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type UpdateTodoDescriptionInput = z.infer<
  typeof updateTodoDescriptionSchema
>;
export type UpdateTodoTextInput = z.infer<typeof updateTodoTextSchema>;
export type UpdateTodoContentInput = z.infer<typeof updateTodoContentSchema>;
export type ToggleTodoInput = z.infer<typeof toggleTodoSchema>;
export type DeleteTodoInput = z.infer<typeof deleteTodoSchema>;
export type GetTodosInput = z.infer<typeof getTodosSchema>;
