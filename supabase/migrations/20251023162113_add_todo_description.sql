/*
 * Migration: Add description column to todos table
 * Purpose: Provide space for storing extended todo details separate from the short text label.
 * Tables affected: public.todos (alter column addition)
 * Rollback considerations: Dropping the column would delete any stored descriptions; handle with care if reversal is needed.
 */

-- Add a dedicated description column for longer-form todo content.
alter table public.todos
add column description text;

-- Document the new column to keep database metadata in sync.
comment on column public.todos.description is 'Extended description for the todo item';
