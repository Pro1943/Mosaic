# Mosaic Future Tasks

## Confirmed Complete

- `pnpm build` works.
- `.env` is loaded.
- Supabase schema is running.
- Homepage articles load from real data.
- Article pages load real comparison and narrative summaries.
- Hourly cron removed; `/api/home` now checks staleness on every page open and re-ingests only when >1 hr has passed.
- Concurrency guard added to prevent simultaneous duplicate ingestion runs.
- Obsolete `/api/cron/ingest` route deleted.
- Strict TypeScript checking re-enabled in Next config.
- Zod validation implemented for all Gemini structured outputs.
- **Source overlap** percentage is now deterministic: `(claims corroborated by ≥2 sources) / total claims × 100`. Old arbitrary weighted formula removed.
- Central `MOSAIC_SYSTEM_INSTRUCTION` added and applied to every Gemini API call.
- Sports pipeline fixed: native sports endpoints per provider + `isSportsArticle()` post-filter + `INSUFFICIENT_SPORTS_COVERAGE` error code.
- Mobile/tablet sidebar drawer implemented for Home and About navigation.
- Header subtitle vertically aligned with logo; unused search icon removed.
- **Fetch More** button added to homepage: `GET /api/home/more` (no ingestion), generates cards for uncached topics only, appends results with topic-ID deduplication, loading/disabled/error states.
- `pnpm tsc --noEmit` passes with zero errors.


## Future Verification

- Confirm the staleness check in `/api/home` works end-to-end in production:
  - First visit with stale/empty cache should trigger ingestion and return fresh stories (slow, expected).
  - Subsequent visits within 1 hr should return cached stories immediately (fast).
- Confirm article skeletons are replaced independently as comparison and narrative requests finish.
- Confirm all error codes/messages surface correctly in the UI error panel on real failures.

## Future Deployment

- Add all required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GNEWS_API_KEY`, `NEWSDATA_API_KEY`, `CURRENTS_API_KEY`) to Vercel project settings.
- After confirming fresh cache data is generated in production, decide whether old internal-name cache tables should be dropped manually from Supabase.

## Future Cleanup

- Confirm no user-facing copy contains internal pipeline labels.
- Confirm no fallback articles, fake source counts, fake numbers, or placeholder analysis remain.
- Confirm all visual iconography uses Lucide icons rather than text arrows, emojis, or hand-drawn symbols.

## Possible Patches

- Add provider-level timing and counts to `ingestion_runs.details` so errors can identify which upstream failed without exposing noise to normal users.
- Add a small admin-only ingestion status endpoint or hidden debug view if repeated provider/Gemini failures are hard to diagnose.
- Add tests around the homepage staleness path and article analysis cache path.
