create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"courses":[],"reviewProgress":[],"deletedCourseIds":[],"deletedMaterialIds":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_workspaces enable row level security;
revoke all on table public.user_workspaces from anon, authenticated;
grant select, insert, update, delete on table public.user_workspaces to authenticated;

drop policy if exists "Users manage their own workspace" on public.user_workspaces;
create policy "Users manage their own workspace"
  on public.user_workspaces
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_workspaces'
  ) then
    alter publication supabase_realtime add table public.user_workspaces;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-materials', 'course-materials', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

drop policy if exists "Users read their private course PDFs" on storage.objects;
create policy "Users read their private course PDFs"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users upload their private course PDFs" on storage.objects;
create policy "Users upload their private course PDFs"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users update their private course PDFs" on storage.objects;
create policy "Users update their private course PDFs"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'course-materials' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "Users delete their private course PDFs" on storage.objects;
create policy "Users delete their private course PDFs"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-materials' and (storage.foldername(name))[1] = (select auth.uid()::text));
