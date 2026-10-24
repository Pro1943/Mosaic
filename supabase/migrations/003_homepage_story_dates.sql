alter table public.homepage_story_cache
  add column if not exists latest_published_at timestamptz;

update public.homepage_story_cache as cache
set latest_published_at = source_dates.latest_published_at
from (
  select topic_articles.topic_id, max(news_articles.published_at) as latest_published_at
  from public.topic_articles
  join public.news_articles on news_articles.id = topic_articles.article_id
  group by topic_articles.topic_id
) as source_dates
where cache.topic_id = source_dates.topic_id
  and cache.latest_published_at is null;

delete from public.homepage_story_cache
where latest_published_at is null;

create index if not exists homepage_story_cache_latest_published_at_idx
  on public.homepage_story_cache (latest_published_at desc);
