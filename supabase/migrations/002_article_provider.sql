alter table public.news_articles
  add column if not exists provider text not null default 'unknown'
  check (provider in ('gnews', 'newsdata', 'currents', 'unknown'));

create index if not exists news_articles_provider_published_idx
  on public.news_articles(provider, published_at desc);
