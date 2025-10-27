/*
 * migration: add todo content column
 * purpose: introduce a jsonb column to store rich, block-based todo content
 * tables affected: public.todos
 * notes: existing rows are initialized with an empty json array; applications can backfill structured content later
 */
 
-- add a jsonb column to persist structured content for todo items
alter table public.todos
add column content jsonb not null default '[]'::jsonb;
-- document the intent of the new column for future maintainers
comment on column public.todos.content is 'Structured block content for the todo item stored as JSON.';
-- ensure pre-existing rows have an initialized value; future migrations can replace this with richer data if needed
update public.todos
set content = '[]'::jsonb
where content is null;