/*
 * Migration: Enforce non-null user ownership on todos
 * Purpose: Prevent orphaned todo records by requiring user_id
 * Tables affected: public.todos (user_id column)
 * Notes:
 *   - Fails if any existing todo rows have a null user_id. Clean data first.
 *   - Preserves existing foreign key and cascade behavior.
 */

-- ensure user_id is present on every todo row at the database level
alter table public.todos
  alter column user_id set not null;
