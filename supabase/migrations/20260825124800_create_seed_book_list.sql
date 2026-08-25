-- seed_book_list: backs seed-cache's warmup list. Replaces the hardcoded
-- POPULAR_BOOKS array (previously split across supabase/functions/seed-cache/_books/part{1..4}.ts)
-- which kept hitting deploy_edge_function's transport limits every time it grew
-- (per-file ~50-60KB limit, AND a separate aggregate all-files-in-one-call output
-- limit discovered 2026-08-25 that the 4-file split didn't solve). Storing the
-- list in the DB means future growth is just an INSERT -- no edge function
-- redeploy required at all.
create table if not exists public.seed_book_list (
  id bigint generated always as identity primary key,
  entry text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists seed_book_list_entry_unique
  on public.seed_book_list (lower(trim(entry)));

alter table public.seed_book_list enable row level security;

create policy seed_book_list_deny_all
  on public.seed_book_list
  for all
  to public
  using (false)
  with check (false);
