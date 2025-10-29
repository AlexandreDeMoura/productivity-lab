/*
 * migration: simplifying_project_members
 * created: 2025-10-28 18:11:00 utc
 * purpose: replace recursive project_members RLS policies with simplified self-scoped policies.
 */

begin;

-- remove policies that traverse back into projects and caused recursive evaluation.
drop policy if exists "authenticated_project_members_select_accessible" on public.project_members;
drop policy if exists "authenticated_project_members_insert_owner" on public.project_members;
drop policy if exists "authenticated_project_members_update_owner" on public.project_members;
drop policy if exists "authenticated_project_members_delete_owner" on public.project_members;

-- authenticated users can only act on membership rows where they are the member.
create policy "authenticated_project_members_select_self"
  on public.project_members
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "authenticated_project_members_insert_self"
  on public.project_members
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "authenticated_project_members_update_self"
  on public.project_members
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "authenticated_project_members_delete_self"
  on public.project_members
  for delete
  to authenticated
  using (user_id = auth.uid());

commit;
