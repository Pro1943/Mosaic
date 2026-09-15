create table if not exists public.news_articles (
  id text primary key,
  source text not null,
  headline text not null,
  author text,
  published_at timestamptz,
  body text not null,
  url text not null unique,
  category text not null check (category in ('world', 'economy', 'sports', 'others')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id text primary key,
  category text not null check (category in ('world', 'economy', 'sports', 'others')),
  title_hint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topic_articles (
  topic_id text not null references public.topics(id) on delete cascade,
  article_id text not null references public.news_articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (topic_id, article_id)
);

create table if not exists public.homepage_story_cache (
  topic_id text primary key references public.topics(id) on delete cascade,
  category text not null check (category in ('world', 'economy', 'sports', 'others')),
  neutral_headline text not null,
  snippet text not null,
  source_count integer not null,
  sources_preview jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.article_extractions (
  topic_id text primary key references public.topics(id) on delete cascade,
  extractions jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.comparison_cache (
  topic_id text primary key references public.topics(id) on delete cascade,
  analysis jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.narrative_cache (
  topic_id text primary key references public.topics(id) on delete cascade,
  analysis jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ingestion_runs (
  id bigint generated always as identity primary key,
  category text not null check (category in ('world', 'economy', 'sports', 'others')),
  status text not null check (status in ('success', 'failed')),
  details jsonb,
  finished_at timestamptz not null default now()
);

create index if not exists news_articles_category_published_idx on public.news_articles(category, published_at desc);
create index if not exists topics_category_updated_idx on public.topics(category, updated_at desc);
create index if not exists homepage_story_category_updated_idx on public.homepage_story_cache(category, updated_at desc);
create index if not exists ingestion_category_finished_idx on public.ingestion_runs(category, finished_at desc);
