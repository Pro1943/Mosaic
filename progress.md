# Mosaic Progress

## 2026-09-12

- Inspected the initial v0-style Next.js UI skeleton.
- Confirmed the app originally had a hardcoded homepage feed and hardcoded in-page article detail view in `app/page.tsx`.
- Added real article routes and split reusable shell/home/article components while preserving the existing visual design.
- Added the requested homepage category sidebar:
  - World/International News
  - Economic News
  - Sports News
  - Others
- Added `.env` keys for Supabase, Gemini, GNews, NewsData, Currents News, cron protection, and configurable Gemini model chains.
- Added Supabase schema at `supabase/migrations/001_mosaic_schema.sql`.
- Added backend modules for news ingestion, deduping, topic clustering, Gemini JSON generation, Supabase caching, and hourly refresh.
- Added API routes for homepage feed, topic metadata, comparison analysis, narrative analysis, and hourly ingestion.
- Replaced Mediastack with Currents News API.
- Added `.env` to `.gitignore` because local credentials are present.
- Replaced text arrows with Lucide icons.
- Added explicit error handling instead of fake fallback articles, source counts, or analysis.
- Added safeguards so empty source-claim extraction, comparison analysis, or narrative analysis is reported as an error instead of displayed as content.
- Improved ingestion quality by filtering obvious non-news/course/program pages and requiring source-domain diversity for topic clusters.
- Optimized homepage loading so `/api/home` reads cached homepage cards only, while `/api/cron/ingest` handles slow news fetching, reclustering, and homepage-card generation.
- Added homepage self-healing: if `/api/home` fails, the client calls `/api/cron/ingest` once, then retries `/api/home` once before showing an error panel.
- Removed product-facing references to internal pipeline labels from routes, UI copy, error text, schema names, and progress notes.

## 2026-09-18

- Removed the Vercel cron job (`0 * * * *`) from `vercel.json` to stay within the Hobby plan limit of one daily cron.
- Moved staleness detection into `/api/home`: on every page open it checks the last successful ingestion time against a 1-hour threshold and triggers a full refresh only when stale, otherwise serves the cached stories immediately.
- Simplified `HomeClient` to a single fetch — the two-step cron-then-retry logic is no longer needed now that the API route handles freshness internally.
- Added a lightweight Supabase lease-based concurrency guard to prevent simultaneous duplicate ingestion runs on stale cache requests.
- Removed obsolete `/api/cron/ingest` endpoint completely.
- Re-enabled strict TypeScript checking by removing `ignoreBuildErrors` in `next.config.mjs`.
- Added minimal runtime Zod validation for Gemini structured outputs.
- Moved `coverage_overlap_percent` calculation from Gemini prompt into application code.
- Added responsive slide-in mobile navigation drawer in `Header` enabling mobile/tablet access to Home and About pages.
- Aligned the header subtitle text with the Mosaic logo and removed the unused search icon.
- Fixed the percentage/math system: replaced arbitrary weighted scoring with a deterministic formula — source overlap is now `(claims corroborated by ≥2 sources) ÷ total claims × 100`. UI label updated to "Source overlap".
- Added a central `MOSAIC_SYSTEM_INSTRUCTION` constant passed as `systemInstruction` to every Gemini call — enforces source fidelity, neutrality, attribution, no outside knowledge, and strict structured output.
- Fixed the sports news pipeline: per-provider native sports category endpoints (`/top-headlines?category=sports` for GNews, `category=sports` for NewsData/Currents) plus a post-fetch `isSportsArticle()` keyword filter. Returns `INSUFFICIENT_SPORTS_COVERAGE` when results are sparse rather than masking the failure.
- Sports category query expanded to include more terms (football, soccer, basketball, tennis, cricket, championship, tournament, athletics).
- Added "Fetch More" feature: new `GET /api/home/more` endpoint (no ingestion triggered) + `generateMoreHomepageCards` generates cards for uncached topics only + "Fetch more stories" button in `HomeClient` with loading/disabled/error states and topic-ID-based deduplication.
- `pnpm tsc --noEmit` passes with zero errors after all changes.
