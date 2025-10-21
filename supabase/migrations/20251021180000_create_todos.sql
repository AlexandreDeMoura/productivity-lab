/*
 * Migration: Create todos table
 * Purpose: Store user todo items with completion status
 * Tables affected: todos (new)
 * RLS: Enabled with policies for authenticated and anonymous users
 */

-- Create todos table
create table public.todos (
  id bigint generated always as identity primary key,
  text text not null,
  done boolean not null default false,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.todos is 'User todo items with completion tracking. Each todo belongs to a user and tracks its completion status.';
comment on column public.todos.id is 'Unique identifier for the todo item';
comment on column public.todos.text is 'The todo item description or task name';
comment on column public.todos.done is 'Whether the todo item has been completed';
comment on column public.todos.user_id is 'Reference to the user who owns this todo';
comment on column public.todos.created_at is 'Timestamp when the todo was created';
comment on column public.todos.updated_at is 'Timestamp when the todo was last updated';

-- Enable Row Level Security
alter table public.todos enable row level security;

-- RLS Policy: Allow authenticated users to select their own todos
create policy "authenticated_users_select_own_todos"
  on public.todos
  for select
  to authenticated
  using (auth.uid() = user_id);

-- RLS Policy: Allow anonymous users to select all todos
-- Note: This allows public read access for demo purposes
create policy "anon_users_select_todos"
  on public.todos
  for select
  to anon
  using (true);

-- RLS Policy: Allow authenticated users to insert their own todos
create policy "authenticated_users_insert_own_todos"
  on public.todos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- RLS Policy: Prevent anonymous users from inserting todos
-- Note: Anonymous users cannot create todos
create policy "anon_users_insert_todos"
  on public.todos
  for insert
  to anon
  with check (false);

-- RLS Policy: Allow authenticated users to update their own todos
create policy "authenticated_users_update_own_todos"
  on public.todos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS Policy: Prevent anonymous users from updating todos
create policy "anon_users_update_todos"
  on public.todos
  for update
  to anon
  using (false)
  with check (false);

-- RLS Policy: Allow authenticated users to delete their own todos
create policy "authenticated_users_delete_own_todos"
  on public.todos
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS Policy: Prevent anonymous users from deleting todos
create policy "anon_users_delete_todos"
  on public.todos
  for delete
  to anon
  using (false);

-- Create index for faster queries by user_id
create index todos_user_id_idx on public.todos (user_id);

-- Create index for filtering by completion status
create index todos_done_idx on public.todos (done);

-- Function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at on record update
create trigger set_updated_at
  before update on public.todos
  for each row
  execute function public.handle_updated_at();