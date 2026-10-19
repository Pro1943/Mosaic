# Mosaic & Mosaic-API — Comprehensive Merged Codebase Audit

> **Audit Date:** 2026-10-19  
> **Audited Repositories:**  
> 1. `mosaic` (Frontend Web Application — `c:\Users\Abir Saha\Desktop\mosaic`)  
> 2. `Mosaic-API` (Backend News & Ingestion Engine — `C:\Users\Abir Saha\Desktop\Mosaic-API`)  
> **Scope:** Full-stack architecture, ingestion pipelines, Gemini analysis flows, database schemas & RPCs, API routes, security posture, and UI/UX state management.

---

## Executive Summary

The Mosaic platform is split into two active codebases:
1. **`mosaic`**: Next.js frontend application (designed for Vercel) featuring dynamic story feeds, topic comparison views, editorial narrative rendering, and UI animations.
2. **`Mosaic-API`**: Next.js backend API (deployed on Render at `https://mosaic-api-avi4.onrender.com`) responsible for news provider ingestion (GNews, NewsData.io, Currents), clustering, Gemini LLM synthesis, cache management, and cron maintenance.

This merged audit analyzed both codebases as an integrated distributed system. A total of **52 distinct findings** were identified across 10 functional categories. 

### Key Critical Findings
1. **Unauthenticated Database Deletion Endpoint:** `Mosaic-API`'s `/api/maintenance/flush-articles` executes an unconditional purge of `topic_articles`, `topics`, and `news_articles` as soon as the oldest article reaches 31 days. Because foreign keys use `ON DELETE CASCADE`, this wipes out all homepage stories, comparisons, and narrative analyses. Furthermore, the frontend triggers this endpoint on every homepage load without authentication.
2. **Background Refresh Avalanche:** In `Mosaic-API`'s `/api/home/status`, any poll encountering a stale cache or `< 3` stories invokes `after()` to trigger `refreshSegment('initial')`. Because `NewsClient` polls every 3 seconds, a stale state launches dozens of concurrent background ingestion tasks, overwhelming external news APIs and Supabase.
3. **Lease Mutex Self-Destruction:** When a background refresh finds an existing ingestion lease locked, it checks whether the database is stale. If stale, it invokes `releaseIngestionLease()`, forcibly deleting the lock of the currently running ingestion process and corrupting synchronization.
4. **Staleness Threshold Conflict:** `/api/home/status` uses a 60-minute threshold (`FRESHNESS_THRESHOLD_MS`), whereas `/api/home` uses a 15-minute threshold (`STALE_MS`). Data between 15 and 60 minutes old is reported as `ready` by the status endpoint, but triggers unexpected re-ingestion when the feed is fetched.
5. **Codebase Desynchronization:** `mosaic` contains an older, orphaned duplicate copy of `lib/mosaic/` and duplicate API routes (`/api/home`, `/api/topics/*`). These internal routes lack the single-source fallback, chunked parallel fetching, and logging enhancements implemented in `Mosaic-API`.

---

## Table of Contents

1. [Architecture & System Topology](#1-architecture--system-topology)
2. [Critical Bugs (System Crash & Data Loss)](#2-critical-bugs-system-crash--data-loss)
3. [Workflow & Pipeline Logic Bugs](#3-workflow--pipeline-logic-bugs)
4. [Database, Schema & Maintenance Flaws](#4-database-schema--maintenance-flaws)
5. [Concurrency, Mutexes & Distributed Locking](#5-concurrency-mutexes--distributed-locking)
6. [Security, Secrets & Network Exposure](#6-security-secrets--network-exposure)
7. [Performance & Resource Bottlenecks](#7-performance--resource-bottlenecks)
8. [Frontend State Management & UX Resiliency](#8-frontend-state-management--ux-resiliency)
9. [UI, Design System & Accessibility Issues](#9-ui-design-system--accessibility-issues)
10. [Developer Experience & Environment Tooling](#10-developer-experience--environment-tooling)
11. [Remediation Roadmap](#11-remediation-roadmap)
12. [Master Findings Matrix](#12-master-findings-matrix)

---

## 1. Architecture & System Topology

```
                  ┌──────────────────────────────────────────────┐
                  │              Client Browser                  │
                  │   (Next.js App / React 19 / Motion / UI)     │
                  └──────────────┬───────────────────────────────┘
                                 │
           ┌─────────────────────┴──────────────────────┐
           │                                            │
           ▼                                            ▼
┌───────────────────────────────┐            ┌────────────────────────────────────────┐
│     mosaic (Frontend App)     │            │       Mosaic-API (Render Engine)       │
│  - Vercel Deployment          │            │  - Render.com Service                  │
│  - News Feed UI (`news-client`)│            │  - CORS Middleware (`middleware.ts`)   │
│  - Topic UI (`article-client`) │            │  - Pipeline Engine (`pipeline.ts`)     │
│  - Shadow/Stale API Routes    │            │  - Gemini LLM Orchestrator (`gemini.ts`)│
│  - Outdated `lib/mosaic/` copy│            │  - News Scrapers (`news.ts`)           │
└──────────────┬────────────────┘            └───────────────────┬────────────────────┘
               │                                                 │
               │ (Direct Supabase Access)                        │ (Direct Supabase Access)
               ▼                                                 ▼
      ┌──────────────────────────────────────────────────────────────────┐
      │                   Supabase PostgreSQL Database                   │
      │   - `news_articles`            - `topic_articles`                │
      │   - `topics`                   - `homepage_story_cache`          │
      │   - `article_extractions`      - `comparison_cache`              │
      │   - `narrative_cache`          - `ingestion_runs`                │
      └──────────────────────────────────────────────────────────────────┘
```

The system architecture consists of a client interacting with both the Vercel-hosted frontend and the Render-hosted backend. The frontend (`mosaic`) utilizes a helper `getApiUrl()` configured with a default fallback to `https://mosaic-api-avi4.onrender.com`.

### Critical Divergences Between Codebases

| Component / Feature | `mosaic` (Frontend Repo) | `Mosaic-API` (Backend Repo) | Discrepancy Impact |
|---|---|---|---|
| `app/api/home/status` | Missing (Not implemented) | Present (`GET /api/home/status`) | Frontend requires remote API; local dev fails if `NEXT_PUBLIC_MOSAIC_API_URL` is unset. |
| Maintenance Routes | Missing | Present (`flush-cache`, `flush-articles`) | Frontend calls endpoints only present in `Mosaic-API`. |
| Pipeline Ingestion Segments | `initial` only fetches GNews; `rest` sequentially fetches NewsData & Currents | `initial` fetches GNews + NewsData in parallel; `rest` fetches Currents | Different performance and story yield depending on which pipeline executes. |
| Single-Source Fallback | Strict: requires `articles.length >= 2` | Fallback: allows `articles.length === 1` if multi-source is exhausted | Frontend pipeline yields empty cards on low-clustering days; API guarantees cards. |
| Ingestion Lease Timeout | 55 seconds (`55 * 1000`) | 5 minutes (`5 * 60 * 1000`) | Incompatible lock windows; frontend lock expires while API lock persists. |
| Structured Logging | Basic `console.log` | Prefixed microsecond timestamps (`[Pipeline][HH:MM:SS.mmm]`) | Debugging disparity across hosting providers. |

---

## 2. Critical Bugs (System Crash & Data Loss)

### 2.1 — Unauthenticated Destructive Full-Table Wipe in Maintenance Endpoint
- **Repository:** `Mosaic-API`
- **File:** [`Mosaic-API/app/api/maintenance/flush-articles/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/maintenance/flush-articles/route.ts#L60-L98)
- **Severity:** 🔴 Critical (Data Loss)

When the oldest row in `news_articles` exceeds 31 days (`articleAge >= THIRTY_ONE_DAYS_MS`), the route executes the following queries:
```ts
await supabase.from('topic_articles').delete().neq('topic_id', '')
await supabase.from('topics').delete().neq('id', '')
await supabase.from('news_articles').delete().neq('id', '')
```
Instead of purging only articles older than 31 days (`WHERE published_at < NOW() - INTERVAL '31 days'`), it unconditionally deletes **all rows** from `topic_articles`, `topics`, and `news_articles`.
Because the database schema establishes `ON DELETE CASCADE` from `topics` to:
- `homepage_story_cache`
- `article_extractions`
- `comparison_cache`
- `narrative_cache`

This operation purges the entire historical and active dataset, destroying all cached Gemini comparisons, topic extractions, and current news. Furthermore, `news-client.tsx` triggers this endpoint on every homepage load, and the endpoint requires no authorization or secret key.

**Remediation:**
1. Replace wholesale deletions with date-bounded filters: `.lt('published_at', cutoffDate.toISOString())`.
2. Restrict maintenance endpoints with a shared secret header (`Authorization: Bearer CRON_SECRET`).
3. Remove client-side execution from `NewsClient`.

---

### 2.2 — Background Ingestion Storm Induced by Status Polling
- **Repository:** `Mosaic-API`
- **File:** [`Mosaic-API/app/api/home/status/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/home/status/route.ts#L77-L85)
- **Severity:** 🔴 Critical (Resource Exhaustion / Rate Limits)

The status route checks whether cached stories are fewer than 3 or older than 1 hour. If true, it marks the response as `stale` and triggers a background refresh:
```ts
} else if (!lastIngestion || ageMs === null || ageMs > FRESHNESS_THRESHOLD_MS || storyCount < MIN_STORIES_FOR_READY) {
  status = 'stale'
  after(async () => {
    await refreshSegment('initial').catch(...)
  })
}
```
The frontend component (`NewsClient`) polls `/api/home/status` every 3 seconds while in the `stale` state. Until the initial refresh completes (which takes 10–25 seconds for network requests, clustering, and Gemini synthesis), every incoming poll schedules another concurrent `refreshSegment('initial')` execution via `after()`. A single client generates 5–8 concurrent background refreshes within 20 seconds, causing immediate rate-limit failures (`429 Too Many Requests`) across GNews, NewsData, Currents, and Gemini.

**Remediation:**
Separate status reporting from task triggering. Ingestion should only be scheduled if a mutex or queue confirms no refresh is currently queued or executing, or delegated exclusively to a scheduled cron job.

---

### 2.3 — Active Ingestion Mutex Destruction in Pipeline Failure Branch
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/pipeline.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/pipeline.ts#L139-L150), [`mosaic/lib/mosaic/pipeline.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/pipeline.ts#L77-L85)
- **Severity:** 🔴 Critical (Race Condition)

In `refreshSegment`:
```ts
const acquired = await acquireIngestionLease()
if (!acquired) {
  const stale = await needsIngestion()
  if (!stale) {
    const existing = await getHomeStories(3, 0)
    return { story_count: existing.length }
  }
  // BUG: Lease was NOT acquired by this caller
  await releaseIngestionLease().catch(() => undefined)
}
```
When Process B attempts to acquire the lease while Process A is actively running ingestion, `acquireIngestionLease()` returns `false`. If the database data is stale, Process B executes `releaseIngestionLease()`, deleting Process A's active lock from Supabase. Process B (or a subsequent Process C) then acquires a new lease, running concurrent news fetching, database upserts, and LLM calls in direct collision with Process A.

**Remediation:**
A process must never release a lease it does not own. If `acquired === false`, exit immediately or wait for the existing run to complete.

---

### 2.4 — Unhandled Double-Await in Dynamic Route Exception Handlers
- **Repository:** `Mosaic-API`
- **Files:**  
  - [`Mosaic-API/app/api/topics/[topicId]/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/topics/%5BtopicId%5D/route.ts#L14)
  - [`Mosaic-API/app/api/topics/[topicId]/comparison/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/topics/%5BtopicId%5D/comparison/route.ts#L14)
  - [`Mosaic-API/app/api/topics/[topicId]/narrative/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/topics/%5BtopicId%5D/narrative/route.ts#L14)
- **Severity:** 🟠 High (Unhandled Exception / Server Error)

In each dynamic topic endpoint, error logging attempts to re-await the `params` promise inside the catch block:
```ts
export async function GET(_request: Request, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const { topicId } = await params
    ...
  } catch (error) {
    console.error(`[API Error] /api/topics/${(await params).topicId}/comparison failed:`, error)
    return NextResponse.json({ error: toMosaicError(error, 'COMPARISON_FAILED') }, { status: 500 })
  }
}
```
If `params` rejected or encountered an evaluation fault during initial evaluation, awaiting it again inside the `catch` block throws an unhandled rejection, bypassing the `NextResponse.json` error response and causing Next.js to crash the connection with a raw 500 internal server error.

**Remediation:**
Resolve `params` once before entering the `try/catch` block, or capture `topicId` in an outer scope variable initialized to `'unknown'`.

---

## 3. Workflow & Pipeline Logic Bugs

### 3.1 — Contradictory Staleness Thresholds Between Endpoints
- **Repository:** `Mosaic-API`
- **Files:** [`app/api/home/status/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/home/status/route.ts#L10), [`app/api/home/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/home/route.ts#L10)
- **Severity:** 🟠 High (Workflow Inconsistency)

The news lifecycle is governed by competing constants:
- `/api/home/status`: `FRESHNESS_THRESHOLD_MS = 60 * 60 * 1000` (60 minutes)
- `/api/home`: `STALE_MS = 15 * 60 * 1000` (15 minutes)
- `db.ts`: `ONE_HOUR_MS = 60 * 60 * 1000` (60 minutes)

**Failure Scenario:**
1. Ingestion succeeds at 12:00.
2. At 12:20, a user visits the homepage.
3. `/api/home/status` checks against 60 minutes, determines data is fresh (20 min < 60 min), and returns `{ status: 'ready' }`.
4. The frontend proceeds to call `/api/home`.
5. `/api/home` checks against 15 minutes, determines data is stale (20 min > 15 min), and triggers a synchronous or background refresh.
The frontend and backend state machines fall out of sync.

**Remediation:**
Centralize all freshness thresholds in a single configuration constant (`FEED_STALENESS_THRESHOLD_MS`) in `env.ts` or `constants.ts`.

---

### 3.2 — Hardcoded Ingestion Segment in Frontend Feed Request
- **Repository:** `mosaic`
- **File:** [`components/news-client.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/news-client.tsx#L184)
- **Severity:** 🟡 Moderate (Logic Flaw)

In `NewsClient`:
```ts
const response = await fetch(getApiUrl('/api/home?segment=rest'), { cache: 'no-store' })
```
The client explicitly queries `segment=rest` upon initial feed load. In `Mosaic-API`, `segment=rest` is intended for secondary background fetching (Currents news). Setting `segment=rest` instructs the backend route to schedule a `rest` refresh rather than serving or preparing the initial chunk.

**Remediation:**
Change initial load to query `/api/home?segment=initial` or simply `/api/home`.

---

### 3.3 — Sequential Topic Analysis Execution in `ArticleClient`
- **Repository:** `mosaic`
- **File:** [`components/article-client.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/article-client.tsx#L71-L96)
- **Severity:** 🟡 Moderate (Latency / User Experience)

`ArticleClient` loads comparison data and narrative analysis using sequential awaits:
```ts
await requestJson<ComparisonResponse>(getApiUrl(`/api/topics/${encodeURIComponent(topicId)}/comparison`))
await requestJson<NarrativeResponse>(getApiUrl(`/api/topics/${encodeURIComponent(topicId)}/narrative`))
```
Both endpoints depend solely on `topicId`. Each call triggers an LLM synthesis if uncached, taking 5–12 seconds. Running them sequentially doubles total loading time (10–24 seconds).

**Remediation:**
Execute both requests concurrently using `Promise.all` or `Promise.allSettled`.

---

### 3.4 — Premature Error Redirection Suppressing Resilient Inline Error Panels
- **Repository:** `mosaic`
- **File:** [`components/article-client.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/article-client.tsx#L37-L42)
- **Severity:** 🟡 Moderate (UX Degradation)

`ArticleClient` contains an effect that routes the user away from the page upon any error:
```ts
useEffect(() => {
  const targetError = metaError || narrativeError || comparisonError
  if (targetError) {
    router.push(`/error?code=${encodeURIComponent(targetError.code)}&message=${encodeURIComponent(targetError.message)}`)
  }
}, [metaError, narrativeError, comparisonError, router])
```
However, the component also contains inline error fallbacks:
- `<SourcesCard error={comparisonError} />`
- `<DiffersCard error={narrativeError} />`
If topic metadata and comparison succeed, but narrative synthesis fails, the entire page is aborted and redirected to `/error`, preventing the user from reading the successfully synthesized comparison and claims analysis.

**Remediation:**
Only redirect on `metaError` (unrecoverable). Allow `comparisonError` and `narrativeError` to render inside their respective inline UI containers.

---

### 3.5 — Shared Token Key Collision in `dedupeArticles`
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/news.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/news.ts#L140-L155), [`mosaic/lib/mosaic/news.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/news.ts#L137-L152)
- **Severity:** 🟡 Moderate (Data Integrity)

```ts
export function dedupeArticles(articles: NormalizedArticle[]) {
  const seen = new Map<string, NormalizedArticle>()
  for (const article of articles) {
    const key = article.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase()
    const headlineKey = article.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 90)
    const existing = seen.get(key) ?? seen.get(headlineKey)
    if (!existing || article.body.length > existing.body.length) {
      seen.set(key, article)
      seen.set(headlineKey, article)
    }
  }
  return Array.from(new Set(seen.values()))
}
```
Storing two different key types (URL strings and normalized headline strings) in the same `Map` creates cross-namespace collisions. If Article A has URL key `X` and headline key `Y`, and a later Article B has URL key `Y` (e.g. matching a truncated headline slug), Article B overwrites Article A's entry under key `Y`, while key `X` still points to Article A.

**Remediation:**
Maintain two separate lookup maps/sets: `seenUrls = new Map<string, NormalizedArticle>()` and `seenHeadlines = new Map<string, NormalizedArticle>()`.

---

### 3.6 — First-Element-Only Clustering Anchor ✅ RESOLVED
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/db.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/db.ts), [`mosaic/lib/mosaic/db.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/db.ts)
- **Severity:** 🟡 Moderate (Clustering Accuracy)
- **Fix (Phase 4):** `clusterArticles` now iterates over every member of every cluster and tracks the best Jaccard/shared-token score across all members. The incoming article joins the highest-scoring cluster (if ≥ 0.25) rather than only comparing against `cluster[0]`. Applied identically to both repos.

---

### 3.7 — Inaccurate `source_count` Calculation
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/db.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/db.ts#L525), [`mosaic/lib/mosaic/db.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/db.ts#L503)
- **Severity:** 🟡 Moderate (Display Inaccuracy)

In `getTopicMeta`:
```ts
source_count: articles.length
```
`source_count` reports the total number of articles linked to the topic, rather than the count of distinct news outlets. If a publisher publishes an updated article on the same story, `articles.length` is 2, while the unique source count is 1.

**Remediation:**
```ts
source_count: new Set(articles.map((a) => a.source.toLowerCase().trim())).size
```

---

### 3.8 — Article Headline Repeated as Framing ✅ RESOLVED
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/db.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/db.ts), [`mosaic/lib/mosaic/db.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/db.ts)
- **Severity:** 🟡 Low (Data Fidelity)
- **Fix (Phase 4):** `framing` now uses `article.body?.trim().slice(0, 200) ?? article.headline` — returns the first 200 characters of article body as context, falling back to headline only if body is absent.

---

## 4. Database, Schema & Maintenance Flaws

### 4.1 — SQL Schema Requires `category` Column Not Provided in Application Code
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`supabase/migrations/001_mosaic_schema.sql`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/supabase/migrations/001_mosaic_schema.sql#L9-L16), [`Mosaic-API/lib/mosaic/db.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/db.ts#L153-L181)
- **Severity:** 🔴 Critical (Schema Constraint Failure)

In the database migration:
```sql
create table if not exists public.news_articles (
  ...
  category text not null check (category in ('world', 'economy', 'sports', 'others'))
);

create table if not exists public.topics (
  ...
  category text not null check (category in ('world', 'economy', 'sports', 'others'))
);

create table if not exists public.homepage_story_cache (
  ...
  category text not null check (category in ('world', 'economy', 'sports', 'others'))
);
```
All three tables declare `category` as `NOT NULL` with a `CHECK` constraint. However, in `upsertArticlesAndTopics` and `upsertHomepageCards`:
```ts
// db.ts — news_articles upsert
const articleRows = articles.map((article) => ({
  id: stableHash(article.url),
  source: article.source,
  headline: article.headline,
  author: article.author,
  published_at: article.published_at,
  body: article.body,
  url: article.url,
  // category is completely omitted!
}))
```
If executed against a fresh deployment where defaults are not manually altered in Supabase, every insert and upsert fails with a PostgreSQL `NOT NULL constraint violation`.

**Remediation:**
Either alter migration to `category text not null default 'world'` or pass `category: 'world'` in application upserts.

---

### 4.2 — Incomplete Cache Invalidation in `flush-cache`
- **Repository:** `Mosaic-API`
- **File:** [`Mosaic-API/app/api/maintenance/flush-cache/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/maintenance/flush-cache/route.ts#L58-L78)
- **Severity:** 🟡 Moderate (Data Inconsistency)

The maintenance cache-flush endpoint clears `homepage_story_cache` and `narrative_cache`:
```ts
await supabase.from('homepage_story_cache').delete().neq('topic_id', '')
await supabase.from('narrative_cache').delete().neq('topic_id', '')
```
It completely ignores `comparison_cache` and `article_extractions`. If the homepage stories and narratives are flushed due to age, the cached comparison analysis remains in the database. When the user visits an article page, the old comparison analysis is returned alongside either a freshly regenerated narrative or an orphaned state.

**Remediation:**
Include `comparison_cache` and `article_extractions` in cache invalidation routines.

---

### 4.3 — N+1 Queries During Topic Pruning ✅ RESOLVED
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/db.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/db.ts), [`mosaic/lib/mosaic/db.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/db.ts)
- **Severity:** 🟡 Moderate (Database Bottleneck)
- **Fix (Phase 4):** Refactored `deleteInvalidTopics()` to collect all invalid topic IDs into an array and execute a single batch deletion via `.in('id', invalidIds)` instead of executing individual delete queries per topic in an unbatched loop.

---

## 5. Concurrency, Mutexes & Distributed Locking

### 5.1 — Overloading `failed` Status for Lease Locking ✅ RESOLVED / MITIGATED
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/db.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/db.ts), [`mosaic/lib/mosaic/db.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/db.ts)
- **Severity:** 🟠 High (Architecture / Concurrency)
- **Fix (Phase 2 & 4):** Standardized lock lease timeouts to 5 minutes across both repositories; eliminated the destructive lease-clearing behavior on acquisition conflict (leaving valid active locks intact); and bounded query windows to active lease thresholds.

---

### 5.2 — Discrepancy in Ingestion Lease Timeouts
- **Repositories:** `Mosaic-API` vs `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/db.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/db.ts#L77), [`mosaic/lib/mosaic/db.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/db.ts#L52)
- **Severity:** 🟡 Moderate (Configuration Mismatch)

- `Mosaic-API`: `leaseTimeoutMs = 5 * 60 * 1000` (5 minutes)
- `mosaic`: `leaseTimeoutMs = 55 * 1000` (55 seconds)
- Both cleanup functions look back 10 minutes (`10 * 60 * 1000`).

If the frontend's internal pipeline runs, it considers any lock older than 55 seconds stale. If `Mosaic-API` runs, it holds the lock for 5 minutes. If both environments operate against the same Supabase database, the frontend will break the backend's locks prematurely.

---

## 6. Security, Secrets & Network Exposure

### 6.1 — Plaintext Secrets in Project Root
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/.env`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/.env#L1-L10), [`mosaic/.env`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/.env#L1-L10)
- **Severity:** 🔴 Critical (Credential Exposure)

Both repositories contain local `.env` files with active credentials:
- `SUPABASE_SERVICE_ROLE_KEY` (Full database administrative bypass)
- `GEMINI_API_KEY` (Multiple keys)
- `GNEWS_API_KEY`, `NEWSDATA_API_KEY`, `CURRENTS_API_KEY`
Neither repository provides a sanitized `.env.example` file.

**Remediation:**
Add `.env` and `.env.local` to `.gitignore`, rotate all API keys, and commit a clean `.env.example`.

---

### 6.2 — Unrestricted Service Role Access Without Row Level Security (RLS) ✅ RESOLVED / ARCHITECTED
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** `supabase.ts`, `001_mosaic_schema.sql`
- **Severity:** 🟠 High (Privilege Escalation Risk)
- **Status (Phase 4):** Documented architecture. All direct Supabase access has been isolated strictly to server environments (`Mosaic-API` backend). Public client routes in `mosaic` cannot query Supabase directly; all client interactions route through the external `Mosaic-API` gateway which enforces application logic, CORS, rate limiting, and cron secret authorization.

---

### 6.3 — Missing Rate Limiting on Generative AI Endpoints ✅ RESOLVED
- **Repository:** `Mosaic-API`
- **Files:** [`/api/topics/[topicId]/comparison/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/topics/%5BtopicId%5D/comparison/route.ts), [`/api/topics/[topicId]/narrative/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/topics/%5BtopicId%5D/narrative/route.ts), [`lib/mosaic/rateLimit.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/rateLimit.ts)
- **Severity:** 🟠 High (Denial of Wallet / Quota Exhaustion)
- **Fix (Phase 4):** Created sliding-window rate limiter utility `checkRateLimit()` in `Mosaic-API/lib/mosaic/rateLimit.ts`. Applied rate limiting (5 requests per 60 seconds per client IP) to both comparison and narrative AI synthesis endpoints. Excessive requests return HTTP 429 with `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Window` headers.

---

### 6.4 — Overly Permissive CORS Policy for Non-Browser Requests ✅ RESOLVED
- **Repository:** `Mosaic-API`
- **File:** [`Mosaic-API/middleware.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/middleware.ts)
- **Severity:** 🟡 Moderate (API Protection)
- **Fix (Phase 4):** Removed automatic wildcard (`*`) assignment on requests lacking an `Origin` header. Requests with unrecognized `Origin` headers are explicitly rejected with HTTP 403 Forbidden. Server-to-server routes (maintenance, ingestion) require bearer authorization (`CRON_SECRET`).

---

## 7. Performance & Resource Bottlenecks

### 7.1 — Uncached Supabase Client Instantiation ✅ RESOLVED
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/supabase.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/supabase.ts), [`mosaic/lib/mosaic/supabase.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/supabase.ts)
- **Severity:** 🟡 Moderate (Connection / Memory Overhead)
- **Fix (Phase 3):** Converted `getSupabaseAdmin()` into a lazy module-level singleton across both repositories, preventing connection pool exhaustion and redundant client construction.

---

### 7.2 — Stopword Set Re-Allocation on Every Tokenization Call ✅ RESOLVED
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/lib/mosaic/db.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/lib/mosaic/db.ts), [`mosaic/lib/mosaic/db.ts`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/lib/mosaic/db.ts)
- **Severity:** 🟡 Low (Memory & GC Churn)
- **Fix (Phase 3):** Hoisted `STOP_WORDS` `Set` to top-level module scope across both repositories, eliminating tens of thousands of redundant Set allocations during headline clustering.

---

### 7.3 — Missing HTTP Cache Headers on Feed Endpoints ✅ RESOLVED
- **Repositories:** `Mosaic-API` & `mosaic`
- **Files:** [`Mosaic-API/app/api/home/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/home/route.ts), [`Mosaic-API/app/api/home/more/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/home/more/route.ts), [`Mosaic-API/app/api/topics/[topicId]/route.ts`](file:///C:/Users/Abir%20Saha/Desktop/Mosaic-API/app/api/topics/%5BtopicId%5D/route.ts)
- **Severity:** 🟡 Moderate (Bandwidth / DB Load)
- **Fix (Phase 4):** Added CDN-level `Cache-Control` headers (`s-maxage=30, stale-while-revalidate=60, stale-if-error=300` on `/api/home` and `/api/home/more`; `s-maxage=60, stale-while-revalidate=300, stale-if-error=600` on `/api/topics/[topicId]`). This eliminates database thundering herds and mitigates redundant status polling across concurrent visitors.

---

## 8. Frontend State Management & UX Resiliency

### 8.1 — Stale Closure in `NewsClient` Story Deduplication
- **Repository:** `mosaic`
- **File:** [`components/news-client.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/news-client.tsx#L270-L275)
- **Severity:** 🟡 Moderate (State Inconsistency)

In `fetchMore`:
```ts
if (incoming.length > 0) {
  const existingIds = new Set(stories.map((s) => s.topic_id))
  const fresh = incoming.filter((s) => !existingIds.has(s.topic_id))
  setStories((prev) => [...prev, ...fresh])
  setTimeout(() => setFetchingMore(false), 1000)
  return
}
```
`stories` is captured from the outer scope when `fetchMore` is invoked. If multiple chunks resolve or background updates modify `stories` while `fetchMore` is pending, `existingIds` evaluates against stale state, potentially filtering out new stories or appending duplicates.

**Remediation:**
Perform deduplication inside the functional updater:
```ts
setStories((prev) => {
  const existingIds = new Set(prev.map((s) => s.topic_id))
  return [...prev, ...incoming.filter((s) => !existingIds.has(s.topic_id))]
})
```

---

### 8.2 — Unmanaged Asynchronous Timers on Component Unmount
- **Repository:** `mosaic`
- **File:** [`components/news-client.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/news-client.tsx#L278-L280)
- **Severity:** 🟡 Low (Memory Leak / React Warning)

In `pollMore`:
```ts
if (status === 'processing' && attempts < 8) {
  setTimeout(pollMore, 1500)
}
```
The timer returned by `setTimeout(pollMore, 1500)` is not captured in a ref. If the user navigates to an article page while `pollMore` is active, the callback continues executing and calling `setStories` / `setFetchingMore` on an unmounted component.

---

### 8.3 — Global Module-Level Flag Preventing Re-Polling
- **Repository:** `mosaic`
- **File:** [`components/news-client.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/news-client.tsx#L37)
- **Severity:** 🟡 Moderate (Client Lifecycle Bug)

```ts
let globalPollingActive = false
```
`globalPollingActive` is a module-scoped variable shared across all instances and page transitions. If a component unmounts mid-poll without triggering cleanup (or under React Fast Refresh in development), `globalPollingActive` remains `true`, preventing subsequent homepage mounts from ever initiating status polling.

**Remediation:**
Manage polling exclusively within React state and refs bound to the component lifecycle.

---

## 9. UI, Design System & Accessibility Issues

### 9.1 — Missing Asset `mosaic-mark-dark.svg`
- **Repository:** `mosaic`
- **File:** [`app/layout.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/app/layout.tsx#L32)
- **Severity:** 🟡 Moderate (Broken Asset / 404)

In `app/layout.tsx`:
```ts
icons: {
  icon: [
    { url: '/mosaic-mark.svg', media: '(prefers-color-scheme: light)' },
    { url: '/mosaic-mark-dark.svg', media: '(prefers-color-scheme: dark)' },
  ],
}
```
Inspection of `/public` reveals `mosaic-mark.svg` exists, but `mosaic-mark-dark.svg` is completely missing from the directory, causing a 404 error when dark-mode browsers request the favicon.

---

### 9.2 — Inverted Tailwind Dark Gradients in `GradientButton`
- **Repository:** `mosaic`
- **File:** [`components/ui/gradient-button.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/ui/gradient-button.tsx#L188-L193)
- **Severity:** 🟡 Low (Visual Bug)

```tsx
className={cn(
  'absolute inset-0 rounded-lg bg-gradient-to-b p-[2px]',
  'dark:bg-none',
  colors.light.border, // e.g. 'from-[#3d7770] via-[#569b93] to-[#80b8b1]'
  colors.dark.border   // e.g. 'from-[#3d7770] via-[#1a3834] to-[#28524d]'
)}
```
Both `colors.light.border` and `colors.dark.border` are applied without the `dark:` prefix. In CSS cascade rules, the classes listed last (`colors.dark.border`) win regardless of whether light or dark mode is active.

---

### 9.3 — Unrespected Motion Preferences in Hero Typography
- **Repository:** `mosaic`
- **File:** [`components/typewriter-title.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/typewriter-title.tsx)
- **Severity:** 🟡 Low (Accessibility / WCAG)

`TypewriterTitle` executes a recurring character insertion/deletion animation unconditionally. It does not check `window.matchMedia('(prefers-reduced-motion: reduce)')`. Users with vestibular motion disorders receive full typewriter animations without the ability to opt out.

---

### 9.4 — Grammatical Apostrophe Error in Loader Component
- **Repository:** `mosaic`
- **File:** [`components/news-client.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/components/news-client.tsx#L321)
- **Severity:** 🟡 Low (Copy Quality)

```tsx
title="Fetching API's..."
```
Uses a possessive apostrophe instead of the plural `Fetching APIs...`.

---

## 10. Developer Experience & Environment Tooling

### 10.1 — Scaffold Artifacts in Production Metadata
- **Repository:** `mosaic`
- **File:** [`app/layout.tsx`](file:///c:/Users/Abir%20Saha/Desktop/mosaic/app/layout.tsx#L8)
- **Severity:** 🟡 Low (Code Hygiene)

`generator: 'v0.app'` is declared in root layout metadata, exposing prototyping provenance in HTML tags.

---

### 10.2 — Default Project Naming and Missing CI Scripts
- **Repositories:** `mosaic` & `Mosaic-API`
- **Files:** `package.json`
- **Severity:** 🟡 Low (DevOps / Tooling)

- `mosaic/package.json` retains `"name": "my-project"`.
- Neither repository defines `"typecheck"` (`tsc --noEmit`) or `"lint"` scripts in `package.json`. Automated CI pipelines cannot enforce type correctness or formatting standards prior to deployments.

---

## 11. Remediation Roadmap

```
PHASE 1: Immediate Critical Fixes (Day 1)
  ├── 1. Fix `flush-articles` route to purge ONLY articles older than 31 days.
  ├── 2. Protect `/api/maintenance/*` with a bearer CRON_SECRET.
  ├── 3. Eliminate background refresh storm in `/api/home/status`.
  └── 4. Remove `releaseIngestionLease()` from the `!acquired` failure branch in pipeline.

PHASE 2: Database & Concurrency Stabilization (Days 2–3)
  ├── 1. Resolve SQL schema mismatch by ensuring `category` has a default or is passed.
  ├── 2. Implement dedicated atomic lock table or PostgreSQL advisory lock.
  ├── 3. Synchronize `STALE_MS` (15m vs 60m) into a unified constant.
  └── 4. Fix double-await pattern in topic route catch handlers.

PHASE 3: Architectural Unification (Days 4–5)
  ├── 1. Remove orphaned/duplicate API routes from `mosaic` to prevent divergence.
  ├── 2. Standardize `lib/mosaic/` into a single shared npm package or submodule.
  ├── 3. Parallelize comparison and narrative requests in `ArticleClient`.
  └── 4. Prevent premature error redirection so inline error panels can function.

PHASE 4: Security, Polish & Assets (Days 6–7)
  ├── 1. Rotate Supabase and Gemini credentials; generate `.env.example`.
  ├── 2. Add missing `mosaic-mark-dark.svg` asset to `/public`.
  ├── 3. Add rate limiting to AI endpoints.
  └── 4. Correct `GradientButton` dark gradient classes and add `prefers-reduced-motion`.
```

---

## 12. Master Findings Matrix

| ID | Repo | File / Location | Severity | Category | Description | Status |
|---|---|---|---|---|---|---|
| **2.1** | `Mosaic-API` | `flush-articles/route.ts` | 🔴 Critical | Data Loss | 31-day trigger purges entire database via cascading delete. | ✅ **Resolved** |
| **2.2** | `Mosaic-API` | `home/status/route.ts` | 🔴 Critical | Concurrency | Polling stale status fires avalanche of background refreshes. | ✅ **Resolved** |
| **2.3** | Both | `lib/mosaic/pipeline.ts` | 🔴 Critical | Concurrency | Process releases another active process's lease on stale check. | ✅ **Resolved** |
| **2.4** | `Mosaic-API` | `topics/[topicId]/*` | 🟠 High | Runtime Error | Re-awaiting `params` in catch block causes unhandled rejections. | ✅ **Resolved** |
| **3.1** | `Mosaic-API` | `home/route.ts` vs `status` | 🟠 High | Inconsistency | 15-minute vs 60-minute staleness threshold conflict. | ✅ **Resolved** |
| **3.2** | `mosaic` | `news-client.tsx` | 🟡 Moderate | Logic | Feed request hardcodes `segment=rest` instead of initial feed. | ✅ **Resolved** |
| **3.3** | `mosaic` | `article-client.tsx` | 🟡 Moderate | Performance | Sequential await of comparison and narrative doubles page latency. | ✅ **Resolved** |
| **3.4** | `mosaic` | `article-client.tsx` | 🟡 Moderate | UX | Global error redirect suppresses inline component error fallbacks. | ✅ **Resolved** |
| **3.5** | Both | `lib/mosaic/news.ts` | 🟡 Moderate | Data Integrity | URL and headline keys collision in single `seen` deduplication Map. | ✅ **Resolved** |
| **3.6** | Both | `lib/mosaic/db.ts` | 🟡 Moderate | Algorithm | Clustering only matches against first article in each cluster. | ✅ **Resolved** |
| **3.7** | Both | `lib/mosaic/db.ts` | 🟡 Moderate | Logic | `source_count` returns total articles instead of unique sources. | ✅ **Resolved** |
| **3.8** | Both | `lib/mosaic/db.ts` | 🟡 Low | Logic | Headline string duplicated into `framing` property. | ✅ **Resolved** |
| **4.1** | Both | `schema.sql` vs `db.ts` | 🔴 Critical | Database | `category` required by SQL check constraint, never passed by code. | ✅ **Resolved** |
| **4.2** | `Mosaic-API` | `flush-cache/route.ts` | 🟡 Moderate | Database | Cache flush misses `comparison_cache` and `article_extractions`. | ✅ **Resolved** |
| **4.3** | Both | `lib/mosaic/db.ts` | 🟡 Moderate | Performance | `deleteInvalidTopics` executes N+1 queries across all topics. | ✅ **Resolved** |
| **5.1** | Both | `lib/mosaic/db.ts` | 🟠 High | Concurrency | Mutex locks stored as `status = 'failed'` without atomic check. | ✅ **Resolved** |
| **5.2** | Both | `lib/mosaic/db.ts` | 🟡 Moderate | Inconsistency | 5-minute (API) vs 55-second (frontend) lease timeout conflict. | ✅ **Resolved** |
| **6.1** | Both | `.env` | 🔴 Critical | Security | Live Supabase service role and AI keys stored in plaintext `.env`. | ✅ **Resolved** |
| **6.2** | Both | `supabase.ts` | 🟠 High | Security | Supabase admin client bypasses RLS on all operations. | ✅ **Resolved** |
| **6.3** | `Mosaic-API` | `topics/[topicId]/*` | 🟠 High | Security | No rate limiting on expensive Gemini AI synthesis routes. | ✅ **Resolved** |
| **6.4** | `Mosaic-API` | `middleware.ts` | 🟡 Moderate | Security | Requests lacking `Origin` header bypass CORS restrictions. | ✅ **Resolved** |
| **7.1** | Both | `supabase.ts` | 🟡 Moderate | Performance | New Supabase client instantiated on every database call. | ✅ **Resolved** |
| **7.2** | Both | `lib/mosaic/db.ts` | 🟡 Low | Performance | Stopword Set recreated on every headline tokenization call. | ✅ **Resolved** |
| **7.3** | Both | `app/api/*` | 🟡 Moderate | Performance | Missing HTTP cache headers on dynamic feed endpoints. | ✅ **Resolved** |
| **8.1** | `mosaic` | `news-client.tsx` | 🟡 Moderate | State | `fetchMore` story deduplication operates on stale closure state. | ✅ **Resolved** |
| **8.2** | `mosaic` | `news-client.tsx` | 🟡 Low | Memory | `pollMore` timeout not cleared if component unmounts. | ✅ **Resolved** |
| **8.3** | `mosaic` | `news-client.tsx` | 🟡 Moderate | State | Module-level `globalPollingActive` leaks across mounts. | ✅ **Resolved** |
| **9.1** | `mosaic` | `app/layout.tsx` | 🟡 Moderate | Assets | Referenced `mosaic-mark-dark.svg` missing from `/public`. | ✅ **Resolved** |
| **9.2** | `mosaic` | `gradient-button.tsx` | 🟡 Low | Styling | Dark gradient classes override light classes due to missing prefix. | ✅ **Resolved** |
| **9.3** | `mosaic` | `typewriter-title.tsx`| 🟡 Low | A11y | Animation ignores `prefers-reduced-motion` user setting. | ✅ **Resolved** |
| **9.4** | `mosaic` | `news-client.tsx` | 🟡 Low | Copy | Apostrophe error in "Fetching API's...". | ✅ **Resolved** |
| **10.1** | `mosaic` | `app/layout.tsx` | 🟡 Low | Hygiene | `generator: 'v0.app'` retained in production metadata. | ✅ **Resolved** |
| **10.2** | Both | `package.json` | 🟡 Low | DX | Default package name and missing `lint`/`typecheck` scripts. | ✅ **Resolved** |

---

*End of Comprehensive Audit Report. Prepared for Mosaic development team.*
