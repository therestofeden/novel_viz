-- book_takeaways: stores each user's collaborative takeaway session per book
create table public.book_takeaways (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  cache_key   text not null,
  title       text not null,
  author      text not null,
  book_type   text not null default 'fiction' check (book_type in ('fiction', 'nonfiction')),
  -- AI-generated probing questions (array of {id, question})
  questions   jsonb not null default '[]',
  -- User's answers (array of {questionId, answer})
  answers     jsonb not null default '[]',
  -- Free-form notes the user added
  free_notes  text,
  -- Final synthesized "Your Takeaways" markdown document
  takeaways   text,
  status      text not null default 'draft' check (status in ('draft', 'complete')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One session per user per book (upsert-friendly)
create unique index book_takeaways_user_book
  on public.book_takeaways (user_id, cache_key);

-- Fast lookup by user
create index book_takeaways_user_id
  on public.book_takeaways (user_id);

-- RLS: users can only see and manage their own sessions
alter table public.book_takeaways enable row level security;

create policy "Users manage own takeaways"
  on public.book_takeaways
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger book_takeaways_updated_at
  before update on public.book_takeaways
  for each row execute function public.set_updated_at();
