# Mosaic Future Tasks

## Confirmed Complete

- `pnpm build` works.
- `.env` is loaded.
- Supabase schema is running.
- Homepage articles load from real data.
- Article pages load real comparison and narrative summaries.

## Future Verification

- Recheck the homepage self-healing flow after deployment:
  - `/api/home` should return cached homepage stories.
  - If `/api/home` fails or has no usable stories, the homepage should call `/api/cron/ingest` once and then retry `/api/home`.
  - The UI should show specific error codes/messages if the retry still fails.
- Recheck hourly ingestion in production after Vercel cron has run at least once.
- Confirm article skeletons are replaced independently as comparison and narrative requests finish.

## Future Deployment

- Add the same production values in Vercel project environment variables.
- Confirm Vercel cron is enabled and will call `/api/cron/ingest` hourly from `vercel.json`.
- After confirming fresh cache data is generated in production, decide whether old internal-name cache tables should be dropped manually from Supabase.

## Future Cleanup

- Confirm no user-facing copy contains internal pipeline labels.
- Confirm no fallback articles, fake source counts, fake numbers, or placeholder analysis remain.
- Confirm all visual iconography uses Lucide icons rather than text arrows, emojis, or hand-drawn symbols.
- Remove empty legacy route directories if they still exist locally.

## Possible Patches

- Add a small admin-only ingestion status endpoint or hidden debug view if repeated provider/Gemini failures are hard to diagnose.
- Add provider-level timing and counts to `ingestion_runs.details` so errors can identify which upstream failed without exposing noise to normal users.
- Add a soft cooldown for client-triggered ingestion so multiple browser tabs do not all call `/api/cron/ingest` after the same homepage failure.
- Add tests around the homepage self-healing path and article analysis cache path.
