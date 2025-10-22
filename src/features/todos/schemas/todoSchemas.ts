import { z } from "zod";

// Schema for creating a todo
export const createTodoSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Todo text cannot be empty")
    .max(500, "Todo text cannot exceed 500 characters"),
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
}).refine(
  (data) => data.text !== undefined || data.done !== undefined,
  { message: "At least one field (text or done) must be provided" }
);

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
export type ToggleTodoInput = z.infer<typeof toggleTodoSchema>;
export type DeleteTodoInput = z.infer<typeof deleteTodoSchema>;
export type GetTodosInput = z.infer<typeof getTodosSchema>;