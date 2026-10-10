'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { ChevronRight, Newspaper } from 'lucide-react'
import type { HomeStory, MosaicError } from '@/lib/mosaic/types'
import { getApiUrl } from '@/lib/mosaic/api'
import { ErrorPanel } from './mosaic-error'
import { Loader } from './ui/loader'
import { GradientButton } from './ui/gradient-button'

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusResponse = {
  status: 'ready' | 'refreshing' | 'stale' | 'error'
  lastUpdated: string | null
  ageSeconds: number | null
  refreshStartedAt: string | null
  storyCount: number
}

type HomeResponse = {
  stories?: HomeStory[]
  status?: 'ready' | 'processing' | 'refreshing'
  error?: MosaicError
}

type MoreResponse = {
  stories?: HomeStory[]
  status?: 'ready' | 'processing'
  error?: MosaicError
}

// ── Guard: only one status-poll loop may run at a time across all mounts ───────
let globalPollingActive = false

// ── Constants ──────────────────────────────────────────────────────────────────

/** Poll /api/home/status every N ms while refreshing/stale */
const POLL_INTERVAL_MS = 3000
/** Give up waiting for readiness after this many ms; show retry UI */
const POLL_TIMEOUT_MS = 3 * 60 * 1000

export function NewsClient() {
  const router = useRouter()
  const [stories, setStories] = useState<HomeStory[]>([])
  const [error, setError] = useState<MosaicError | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSubtitle, setLoadingSubtitle] = useState('Checking freshness of news data…')
  const [timedOut, setTimedOut] = useState(false)
  const [fetchingMore, setFetchingMore] = useState(false)
  const [noMoreStories, setNoMoreStories] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)

  // Ref so inner callbacks can read latest values without stale closure
  const isMountedRef = useRef(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // ── Route on error ────────────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      router.push(`/error?code=${encodeURIComponent(error.code)}&message=${encodeURIComponent(error.message)}`)
    }
  }, [error, router])

  // ── Main freshness-first loading loop ────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true

    // ── Run the maintenance checks in the background ──────────────────────
    // These are fire-and-forget; we do not wait for or block on them.
    void triggerMaintenanceChecks()

    if (globalPollingActive) {
      // Another mounted instance is already polling — do nothing.
      // Stories will appear via state lift if needed, but in practice
      // only one NewsClient renders on the /news page.
      return
    }

    globalPollingActive = true
    const startedAt = Date.now()

    async function pollStatus() {
      if (!isMountedRef.current) return

      // ── Timeout guard ──────────────────────────────────────────────────
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        globalPollingActive = false
        if (isMountedRef.current) {
          setTimedOut(true)
          setLoading(false)
        }
        return
      }

      try {
        const res = await fetch(getApiUrl('/api/home/status'), { cache: 'no-store' })
        if (!isMountedRef.current) return

        if (!res.ok) {
          // Network/server error — retry after interval
          scheduleNextPoll(pollStatus)
          return
        }

        const payload = (await res.json()) as StatusResponse
        if (!isMountedRef.current) return

        if (payload.status === 'ready') {
          // ── News is fresh — fetch the actual stories ───────────────────
          globalPollingActive = false
          await fetchHomeStories()
        } else if (payload.status === 'error') {
          globalPollingActive = false
          if (isMountedRef.current) {
            setError({ code: 'STATUS_ERROR', message: 'The news backend reported an internal error.' })
            setLoading(false)
          }
        } else {
          // 'refreshing' | 'stale' — keep polling
          if (isMountedRef.current) {
            setLoadingSubtitle(
              payload.status === 'refreshing'
                ? 'Fetching and processing the latest news…'
                : 'News data is stale — triggering a refresh…',
            )
          }
          scheduleNextPoll(pollStatus)
        }
      } catch {
        if (isMountedRef.current) scheduleNextPoll(pollStatus)
      }
    }

    pollStatus()

    return () => {
      isMountedRef.current = false
      globalPollingActive = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cooldown ticker for "Fetch More" errors ────────────────────────────────
  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) { setMoreError(null); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [cooldownRemaining])

  // ── Helpers ────────────────────────────────────────────────────────────────

  function scheduleNextPoll(fn: () => void) {
    timerRef.current = setTimeout(fn, POLL_INTERVAL_MS)
  }

  async function fetchHomeStories() {
    if (!isMountedRef.current) return
    try {
      setLoadingSubtitle('Loading the latest stories…')
      const response = await fetch(getApiUrl('/api/home?segment=rest'), { cache: 'no-store' })
      if (!isMountedRef.current) return

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        setError({ code: `HTTP_${response.status}`, message: 'Server returned a non-JSON response.' })
        setLoading(false)
        return
      }

      const payload = (await response.json()) as HomeResponse
      if (!isMountedRef.current) return

      if (!response.ok || payload.error) {
        setError(payload.error ?? { code: `HTTP_${response.status}`, message: response.statusText })
        setLoading(false)
        return
      }

      const incoming = payload.stories ?? []
      setStories(incoming)
      // Small visual delay so the transition feels intentional
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) setLoading(false)
      }, 400)
    } catch (err) {
      if (isMountedRef.current) {
        setError({
          code: 'HOME_REQUEST_FAILED',
          message: err instanceof Error ? err.message : 'Could not request news feed.',
        })
        setLoading(false)
      }
    }
  }

  async function triggerMaintenanceChecks() {
    // Fire both maintenance endpoints in parallel; ignore results/errors.
    await Promise.allSettled([
      fetch(getApiUrl('/api/maintenance/flush-cache'), { method: 'POST', cache: 'no-store' }),
      fetch(getApiUrl('/api/maintenance/flush-articles'), { method: 'POST', cache: 'no-store' }),
    ])
  }

  async function fetchMore() {
    if (fetchingMore || noMoreStories || cooldownRemaining > 0) return
    setFetchingMore(true)
    setMoreError(null)

    const offset = stories.length
    let attempts = 0

    async function pollMore() {
      attempts += 1
      try {
        const response = await fetch(getApiUrl(`/api/home/more?offset=${offset}`), { cache: 'no-store' })
        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          setMoreError('Failed to fetch')
          setCooldownRemaining(300)
          setFetchingMore(false)
          return
        }

        const payload = (await response.json()) as MoreResponse
        if (!response.ok || payload.error) {
          setMoreError(payload.error?.message ?? 'Failed to fetch')
          setCooldownRemaining(300)
          setFetchingMore(false)
          return
        }

        const incoming = payload.stories ?? []
        const status = payload.status ?? 'ready'

        if (incoming.length > 0) {
          const existingIds = new Set(stories.map((s) => s.topic_id))
          const fresh = incoming.filter((s) => !existingIds.has(s.topic_id))
          setStories((prev) => [...prev, ...fresh])
          setTimeout(() => setFetchingMore(false), 1000)
          return
        }

        if (status === 'processing' && attempts < 8) {
          setTimeout(pollMore, 1500)
        } else {
          setNoMoreStories(true)
          setFetchingMore(false)
        }
      } catch (err) {
        setMoreError(err instanceof Error ? err.message : 'Failed to fetch')
        setCooldownRemaining(300)
        setFetchingMore(false)
      }
    }

    pollMore()
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main id="latest" className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex items-end justify-between border-b border-border pb-5"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Latest Feed</p>
          <h1 className="mt-2 font-serif text-3xl tracking-[-0.03em] md:text-4xl">News Stories</h1>
        </div>
        <span className="hidden text-xs text-muted-foreground sm:block">Updated throughout the day</span>
      </motion.div>

      {loading ? (
        <div className="py-12">
          <Loader
            title="Fetching API's..."
            subtitle={loadingSubtitle}
            size="lg"
          />
        </div>
      ) : null}

      {/* Timeout / retry UI — shown when backend takes too long to become ready */}
      {!loading && timedOut ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            The news pipeline is taking longer than expected. Please try again in a moment.
          </p>
          <GradientButton
            variant="teal"
            label="Retry"
            onClick={() => {
              setTimedOut(false)
              setLoading(true)
              setLoadingSubtitle('Checking freshness of news data…')
              globalPollingActive = false
              // Re-trigger the effect by remounting would require a key trick;
              // instead, directly restart the poll here
              const startedAt = Date.now()
              async function retry() {
                if (!isMountedRef.current) return
                if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                  setTimedOut(true); setLoading(false); return
                }
                try {
                  const res = await fetch(getApiUrl('/api/home/status'), { cache: 'no-store' })
                  const payload = (await res.json()) as StatusResponse
                  if (payload.status === 'ready') {
                    await fetchHomeStories()
                  } else if (payload.status === 'error') {
                    setError({ code: 'STATUS_ERROR', message: 'The news backend reported an internal error.' })
                    setLoading(false)
                  } else {
                    setLoadingSubtitle(payload.status === 'refreshing'
                      ? 'Fetching and processing the latest news…'
                      : 'News data is stale — triggering a refresh…')
                    timerRef.current = setTimeout(retry, POLL_INTERVAL_MS)
                  }
                } catch {
                  timerRef.current = setTimeout(retry, POLL_INTERVAL_MS)
                }
              }
              globalPollingActive = true
              retry()
            }}
          />
        </div>
      ) : null}

      {!loading && !timedOut && error ? <ErrorPanel error={error} /> : null}

      {!loading && !timedOut && !error ? (
        <div className="grid gap-4">
          {stories.map((story, index) => (
            <motion.div
              key={story.topic_id}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.4) }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              <Link
                href={`/article/${encodeURIComponent(story.topic_id)}`}
                className="group grid w-full gap-6 rounded-xl border border-border bg-card p-6 text-left transition-colors hover:border-foreground/40 md:grid-cols-[1fr_auto] md:items-center md:p-7"
              >
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{story.sources_preview.map((source) => source.name).slice(0, 3).join(' / ')}</span>
                    <span aria-hidden="true">•</span>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <h2 className="max-w-3xl font-serif text-2xl leading-tight tracking-[-0.025em] text-foreground transition-colors group-hover:text-accent md:text-[26px]">
                    {story.neutral_headline}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground line-clamp-3">
                    {story.snippet}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end whitespace-nowrap text-xs font-medium text-muted-foreground md:self-center">
                  <Newspaper size={15} strokeWidth={1.6} />
                  <span>{story.source_count} sources</span>
                  <ChevronRight size={16} className="ml-1.5 text-accent transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : null}

      {!loading && !timedOut && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-3"
        >
          {fetchingMore ? (
            <Loader
              title="Waiting for response from API..."
              subtitle="Fetching additional stories"
              size="sm"
            />
          ) : cooldownRemaining > 0 ? (
            <GradientButton
              variant="orange"
              disabled
              label={`Failed to fetch (${formatTime(cooldownRemaining)})`}
            />
          ) : noMoreStories ? (
            <GradientButton variant="teal" disabled label="No more stories available" />
          ) : (
            <GradientButton
              variant="teal"
              onClick={fetchMore}
              label="Fetch More Stories"
            />
          )}
        </motion.div>
      )}
    </main>
  )
}
