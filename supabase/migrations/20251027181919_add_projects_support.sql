/*
 * migration: add_projects_support
 * created: 2025-10-27 18:19:19 utc
 * purpose: introduce project-level grouping for todos, backfill existing data, and harden rls.
 * affects: public.projects, public.project_members, public.todos
 * notes: drops and recreates todos policies; ensure application code is updated to provide project_id.
 */

-- ------------------------------------------------------------------
-- create table: public.projects
-- projects act as named todo lists owned by a single user.
-- ------------------------------------------------------------------

create table public.projects (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  owner_id uuid not null references auth.users (id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_owner_name_key unique (owner_id, name)
);

comment on table public.projects is 'Projects act as named todo lists and own related todos.';
comment on column public.projects.id is 'Primary key for the project.';
comment on column public.projects.name is 'Human friendly name for the project.';
comment on column public.projects.description is 'Optional extended description for the project.';
comment on column public.projects.owner_id is 'User who owns and administers the project.';
comment on column public.projects.metadata is 'Flexible JSON metadata for future customization.';
comment on column public.projects.created_at is 'Timestamp tracking when the project was created.';
comment on column public.projects.updated_at is 'Timestamp tracking when the project was last updated.';

create index projects_owner_id_idx on public.projects (owner_id);

create trigger set_projects_updated_at
  before update on public.projects
  for each row
  execute function public.handle_updated_at();

alter table public.projects enable row level security;

-- ------------------------------------------------------------------
-- create table: public.project_members
-- membership table allows sharing projects with additional users.
-- ------------------------------------------------------------------

create table public.project_members (
  project_id bigint not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  constraint project_members_pkey primary key (project_id, user_id),
  constraint project_members_role_check check (role in ('member', 'manager'))
);

comment on table public.project_members is 'Associates users with collaborative permissions on a project.';
comment on column public.project_members.project_id is 'Project the member belongs to.';
comment on column public.project_members.user_id is 'User who participates in the project.';
comment on column public.project_members.role is 'Permission level granted to the user within the project.';
comment on column public.project_members.created_at is 'Timestamp when the membership was created.';

create index project_members_user_id_idx on public.project_members (user_id);

alter table public.project_members enable row level security;

-- ------------------------------------------------------------------
-- schema changes: public.todos
-- add project reference and backfill existing records.
-- ------------------------------------------------------------------

alter table public.todos
  add column project_id bigint;

comment on column public.todos.project_id is 'Project the todo belongs to; enforces single-project ownership.';

alter table public.todos
  add constraint todos_project_id_fkey
  foreign key (project_id)
  references public.projects (id)
  on delete cascade;

create index todos_project_id_idx on public.todos (project_id);

-- backfill: create a default project per user and link existing todos.
with distinct_users as (
  select distinct user_id
  from public.todos
),
inserted_projects as (
  insert into public.projects (name, description, owner_id)
  select
    'my todos',
    'Default project created during the multi-list migration.',
    distinct_users.user_id
  from distinct_users
  returning id, owner_id
)
update public.todos todo
set project_id = inserted_projects.id
from inserted_projects
where todo.user_id = inserted_projects.owner_id
  and todo.project_id is null;

-- enforce presence of project references after backfill.
alter table public.todos
  alter column project_id set not null;

-- ------------------------------------------------------------------
-- drop old todo policies before creating new ones
-- ------------------------------------------------------------------

drop policy if exists "authenticated_users_select_own_todos" on public.todos;
drop policy if exists "anon_users_select_todos" on public.todos;
drop policy if exists "authenticated_users_insert_own_todos" on public.todos;
drop policy if exists "anon_users_insert_todos" on public.todos;
drop policy if exists "authenticated_users_update_own_todos" on public.todos;
drop policy if exists "anon_users_update_todos" on public.todos;
drop policy if exists "authenticated_users_delete_own_todos" on public.todos;
drop policy if exists "anon_users_delete_todos" on public.todos;

-- ------------------------------------------------------------------
-- row level security policies for public.project_members
-- ------------------------------------------------------------------

-- authenticated users can read membership rows where they are members or owners.
create policy "authenticated_project_members_select_accessible"
  on public.project_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.projects
      where public.projects.id = public.project_members.project_id
        and public.projects.owner_id = auth.uid()
    )
  );

-- authenticated users can insert members only for projects they own.
create policy "authenticated_project_members_insert_owner"
  on public.project_members
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.projects
      where public.projects.id = public.project_members.project_id
        and public.projects.owner_id = auth.uid()
    )
  );

-- authenticated users can update membership rows only if they own the project.
create policy "authenticated_project_members_update_owner"
  on public.project_members
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.projects
      where public.projects.id = public.project_members.project_id
        and public.projects.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects
      where public.projects.id = public.project_members.project_id
        and public.projects.owner_id = auth.uid()
    )
  );

-- authenticated users can delete membership rows only if they own the project.
create policy "authenticated_project_members_delete_owner"
  on public.project_members
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.projects
      where public.projects.id = public.project_members.project_id
        and public.projects.owner_id = auth.uid()
    )
  );

-- anonymous users keep read-only visibility for demos.
create policy "anon_project_members_select_all"
  on public.project_members
  for select
  to anon
  using (true);

-- anonymous users cannot mutate membership rows.
create policy "anon_project_members_insert_none"
  on public.project_members
  for insert
  to anon
  with check (false);

create policy "anon_project_members_update_none"
  on public.project_members
  for update
  to anon
  using (false)
  with check (false);

create policy "anon_project_members_delete_none"
  on public.project_members
  for delete
  to anon
  using (false);

-- ------------------------------------------------------------------
-- row level security policies for public.projects
-- ------------------------------------------------------------------

-- authenticated users can read projects they own or participate in.
create policy "authenticated_projects_select_accessible"
  on public.projects
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.project_members
      where public.project_members.project_id = public.projects.id
        and public.project_members.user_id = auth.uid()
    )
  );

-- authenticated users can insert projects they will own.
create policy "authenticated_projects_insert_own"
  on public.projects
  for insert
  to authenticated
  with check (owner_id = auth.uid());

-- authenticated users can update projects they own.
create policy "authenticated_projects_update_own"
  on public.projects
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- authenticated users can delete projects they own.
create policy "authenticated_projects_delete_own"
  on public.projects
  for delete
  to authenticated
  using (owner_id = auth.uid());

-- anonymous users retain read-only access for demo scenarios.
create policy "anon_projects_select_all"
  on public.projects
  for select
  to anon
  using (true);

-- anonymous users cannot mutate projects.
create policy "anon_projects_insert_none"
  on public.projects
  for insert
  to anon
  with check (false);

create policy "anon_projects_update_none"
  on public.projects
  for update
  to anon
  using (false)
  with check (false);

create policy "anon_projects_delete_none"
  on public.projects
  for delete
  to anon
  using (false);

-- ------------------------------------------------------------------
-- row level security policies for public.todos
-- ------------------------------------------------------------------

-- authenticated users can read todos they own, or from projects they own or share.
create policy "authenticated_todos_select_accessible"
  on public.todos
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.projects
      where public.projects.id = public.todos.project_id
        and public.projects.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members
      where public.project_members.project_id = public.todos.project_id
        and public.project_members.user_id = auth.uid()
    )
  );

-- authenticated users can insert todos only for themselves and into accessible projects.
create policy "authenticated_todos_insert_accessible"
  on public.todos
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      exists (
        select 1
        from public.projects
        where public.projects.id = public.todos.project_id
          and public.projects.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.project_members
        where public.project_members.project_id = public.todos.project_id
          and public.project_members.user_id = auth.uid()
      )
    )
  );

-- authenticated users can update todos only if they have access to the project.
create policy "authenticated_todos_update_accessible"
  on public.todos
  for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.projects
      where public.projects.id = public.todos.project_id
        and public.projects.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members
      where public.project_members.project_id = public.todos.project_id
        and public.project_members.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and (
      exists (
        select 1
        from public.projects
        where public.projects.id = public.todos.project_id
          and public.projects.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.project_members
        where public.project_members.project_id = public.todos.project_id
          and public.project_members.user_id = auth.uid()
      )
    )
  );

-- authenticated users can delete todos only if they have access to the project.
create policy "authenticated_todos_delete_accessible"
  on public.todos
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.projects
      where public.projects.id = public.todos.project_id
        and public.projects.owner_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members
      where public.project_members.project_id = public.todos.project_id
        and public.project_members.user_id = auth.uid()
    )
  );

-- anonymous users keep read-only access for demos.
create policy "anon_todos_select_all"
  on public.todos
  for select
  to anon
  using (true);

create policy "anon_todos_insert_none"
  on public.todos
  for insert
  to anon
  with check (false);

create policy "anon_todos_update_none"
  on public.todos
  for update
  to anon
  using (false)
  with check (false);

create policy "anon_todos_delete_none"
  on public.todos
  for delete
  to anon
  using (false);
