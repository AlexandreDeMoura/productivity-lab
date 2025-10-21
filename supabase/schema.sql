/*
 * Pandora Box - Database Schema Documentation
 * 
 * This file provides a comprehensive overview of the database schema
 * for use by LLMs and developers working with this codebase.
 * 
 * Project: Pandora Box (Next.js 15.5.5 + Supabase)
 * Database: PostgreSQL (Supabase)
 * Authentication: Supabase Auth
 * Last Updated: 2025-10-21
 */

-- ==================================================================
-- TABLE OF CONTENTS
-- ==================================================================
-- 1. Database Overview
-- 2. Schema Summary
-- 3. Table Definitions
-- 4. Row Level Security (RLS) Policies
-- 5. Indexes
-- 6. Functions & Triggers
-- 7. Common Query Patterns
-- 8. TypeScript Type Definitions

-- ==================================================================
-- 1. DATABASE OVERVIEW
-- ==================================================================
/*
 * Purpose: Task management system for Pandora Box application
 * 
 * Features:
 * - User-specific todo lists
 * - Task completion tracking
 * - Anonymous read access for demos
 * - Automatic timestamp management
 * 
 * Security Model:
 * - RLS enabled on all tables
 * - Authenticated users: Full CRUD on their own data
 * - Anonymous users: Read-only access
 */

-- ==================================================================
-- 2. SCHEMA SUMMARY
-- ==================================================================
/*
 * Schemas:
 * - public: Application tables
 * - auth: Supabase authentication (managed by Supabase)
 * 
 * Tables:
 * - public.todos: User task items with completion status
 * 
 * Functions:
 * - public.handle_updated_at(): Auto-updates updated_at timestamp
 */

-- ==================================================================
-- 3. TABLE DEFINITIONS
-- ==================================================================

-- ------------------------------------------------------------------
-- Table: public.todos
-- ------------------------------------------------------------------
/*
 * Purpose: Store user todo items with completion tracking
 * 
 * Relationships:
 * - user_id -> auth.users(id): Each todo belongs to a user
 * 
 * Cascade Behavior:
 * - When user is deleted: All their todos are automatically deleted
 * 
 * Access Pattern:
 * - Primary access: Filter by user_id
 * - Secondary access: Filter by done status
 * 
 * Business Rules:
 * - text cannot be empty (not null)
 * - done defaults to false for new todos
 * - created_at is set automatically on insert
 * - updated_at is updated automatically on any change
 */

create table public.todos (
  -- Primary key: Auto-incrementing identifier
  id bigint generated always as identity primary key,
  
  -- Task description
  text text not null,
  
  -- Completion status
  done boolean not null default false,
  
  -- User ownership (foreign key to auth.users)
  user_id uuid references auth.users (id) on delete cascade,
  
  -- Audit timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table and column comments for database-level documentation
comment on table public.todos is 'User todo items with completion tracking. Each todo belongs to a user and tracks its completion status.';
comment on column public.todos.id is 'Unique identifier for the todo item';
comment on column public.todos.text is 'The todo item description or task name';
comment on column public.todos.done is 'Whether the todo item has been completed';
comment on column public.todos.user_id is 'Reference to the user who owns this todo';
comment on column public.todos.created_at is 'Timestamp when the todo was created';
comment on column public.todos.updated_at is 'Timestamp when the todo was last updated';

-- ==================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================================

-- Enable RLS on todos table
alter table public.todos enable row level security;

/*
 * RLS Policy Summary for public.todos:
 * 
 * Authenticated Users (logged in):
 * - SELECT: Can read only their own todos (user_id = auth.uid())
 * - INSERT: Can create todos for themselves only
 * - UPDATE: Can modify only their own todos
 * - DELETE: Can remove only their own todos
 * 
 * Anonymous Users (not logged in):
 * - SELECT: Can read all todos (for demo purposes)
 * - INSERT: Cannot create todos
 * - UPDATE: Cannot modify todos
 * - DELETE: Cannot delete todos
 */

-- SELECT Policies
create policy "authenticated_users_select_own_todos"
  on public.todos
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "anon_users_select_todos"
  on public.todos
  for select
  to anon
  using (true);

-- INSERT Policies
create policy "authenticated_users_insert_own_todos"
  on public.todos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "anon_users_insert_todos"
  on public.todos
  for insert
  to anon
  with check (false);

-- UPDATE Policies
create policy "authenticated_users_update_own_todos"
  on public.todos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "anon_users_update_todos"
  on public.todos
  for update
  to anon
  using (false)
  with check (false);

-- DELETE Policies
create policy "authenticated_users_delete_own_todos"
  on public.todos
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "anon_users_delete_todos"
  on public.todos
  for delete
  to anon
  using (false);

-- ==================================================================
-- 5. INDEXES
-- ==================================================================

/*
 * Index Strategy:
 * - todos_user_id_idx: Fast filtering by user (primary access pattern)
 * - todos_done_idx: Fast filtering by completion status
 * 
 * Query Optimization:
 * - Gets user's active tasks: Uses todos_user_id_idx + todos_done_idx
 * - Gets user's completed tasks: Uses todos_user_id_idx + todos_done_idx
 * - Gets all user tasks: Uses todos_user_id_idx
 */

create index todos_user_id_idx on public.todos (user_id);
create index todos_done_idx on public.todos (done);

-- ==================================================================
-- 6. FUNCTIONS & TRIGGERS
-- ==================================================================

/*
 * Function: public.handle_updated_at()
 * 
 * Purpose: Automatically update the updated_at column on row updates
 * 
 * Usage: Attached to tables via trigger
 * 
 * Behavior:
 * - Called before each UPDATE operation
 * - Sets new.updated_at to current timestamp
 * - Returns modified record
 */

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

/*
 * Trigger: set_updated_at on public.todos
 * 
 * Purpose: Ensures updated_at is always current
 * 
 * Timing: BEFORE UPDATE
 * Level: FOR EACH ROW
 */

create trigger set_updated_at
  before update on public.todos
  for each row
  execute function public.handle_updated_at();

-- ==================================================================
-- 7. COMMON QUERY PATTERNS
-- ==================================================================

/*
 * Pattern 1: Get all todos for current user
 * Use case: Display user's full todo list
 */
-- select * from public.todos where user_id = auth.uid() order by created_at desc;

/*
 * Pattern 2: Get active (incomplete) todos for current user
 * Use case: Show only pending tasks
 */
-- select * from public.todos where user_id = auth.uid() and done = false order by created_at desc;

/*
 * Pattern 3: Get completed todos for current user
 * Use case: Show finished tasks
 */
-- select * from public.todos where user_id = auth.uid() and done = true order by updated_at desc;

/*
 * Pattern 4: Insert a new todo
 * Use case: Create a new task
 */
-- insert into public.todos (text, user_id) values ('New task', auth.uid()) returning *;

/*
 * Pattern 5: Toggle todo completion status
 * Use case: Mark task as done/undone
 */
-- update public.todos set done = not done where id = 123 and user_id = auth.uid() returning *;

/*
 * Pattern 6: Delete a specific todo
 * Use case: Remove a task
 */
-- delete from public.todos where id = 123 and user_id = auth.uid();

/*
 * Pattern 7: Clear all completed todos
 * Use case: Bulk remove finished tasks
 */
-- delete from public.todos where user_id = auth.uid() and done = true;

/*
 * Pattern 8: Count active vs completed todos
 * Use case: Show statistics
 */
-- select
--   count(*) filter (where done = false) as active_count,
--   count(*) filter (where done = true) as completed_count
-- from public.todos
-- where user_id = auth.uid();

-- ==================================================================
-- 8. TYPESCRIPT TYPE DEFINITIONS
-- ==================================================================

/*
 * TypeScript types that match the database schema.
 * Use these in your Next.js application for type safety.
 * 
 * Location: Place in src/types/database.ts or similar
 */

/*
export type Todo = {
  id: number;
  text: string;
  done: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type TodoInsert = {
  text: string;
  user_id: string;
  done?: boolean;
};

export type TodoUpdate = {
  text?: string;
  done?: boolean;
};

// Supabase auto-generated types (use `supabase gen types typescript` for full types)
export type Database = {
  public: {
    Tables: {
      todos: {
        Row: Todo;
        Insert: TodoInsert;
        Update: TodoUpdate;
      };
    };
  };
};
*/

-- ==================================================================
-- END OF SCHEMA DOCUMENTATION
-- ==================================================================