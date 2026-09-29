-- supabase/ai_cost_control.sql
-- Навіщо: облік витрат LLM і кеш відповідей.
-- Не впливає на дайджест, оплату, онбординг.

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  usage_date date not null default ((timezone('utc', now()))::date),
  user_id uuid null,
  task text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  usd numeric(12, 6) not null default 0,
  cache_hit boolean not null default false,
  source text null
);

create index if not exists ai_usage_created_at_idx on public.ai_usage (created_at desc);
create index if not exists ai_usage_date_idx on public.ai_usage (usage_date desc);
create index if not exists ai_usage_task_idx on public.ai_usage (task);
create index if not exists ai_usage_user_id_idx on public.ai_usage (user_id);

create table if not exists public.ai_cache (
  key text primary key,
  task text not null,
  output_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_cache_task_idx on public.ai_cache (task);
create index if not exists ai_cache_created_at_idx on public.ai_cache (created_at desc);

alter table public.ai_usage enable row level security;
alter table public.ai_cache enable row level security;

-- Клієнтський anon ключ ці таблиці не читає і не пише.
-- Пише тільки сервер через SUPABASE_SERVICE_ROLE_KEY.

drop policy if exists ai_usage_no_anon on public.ai_usage;
drop policy if exists ai_cache_no_anon on public.ai_cache;

comment on table public.ai_usage is 'Лог кожного LLM-виклику: токени і USD';
comment on table public.ai_cache is 'Кеш відповіді. parse URL TTL 30 днів; why_recommended TTL 7 днів — чистить код, не SQL';
