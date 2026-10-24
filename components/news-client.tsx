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

// ── Constants ──────────────────────────────────────────────────────────────────

/** Poll /api/home/status every N ms while refreshing/stale */
const POLL_INTERVAL_MS = 3000
/** Give up waiting for readiness after this many ms; show retry UI */
const POLL_TIMEOUT_MS = 3 * 60 * 1000

function clog(msg: string, data?: unknown) {
  const prefix = `[Mosaic][${new Date().toISOString().slice(11, 23)}]`
  if (data !== undefined) console.log(prefix, msg, data)
  else console.log(prefix, msg)
}

export function NewsClient() {
  const router = useRouter()
  const [stories, setStories] = useState<HomeStory[]>([])
  const [error, setError] = useState<MosaicError | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSubtitle, setLoadingSubtitle] = useState('Checking for the latest coverage…')
  const [timedOut, setTimedOut] = useState(false)
  const [fetchingMore, setFetchingMore] = useState(false)
  const [noMoreStories, setNoMoreStories] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)

  // Ref so inner callbacks can read latest values without stale closure
  const isMountedRef = useRef(true)
  const isPollingRef = useRef(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const fetchMoreTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ── Route on error ────────────────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      router.push(`/error?code=${encodeURIComponent(error.code)}&message=${encodeURIComponent(error.message)}`)
    }
  }, [error, router])

  // ── Main freshness-first loading loop ────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true
    clog('NewsClient mounted — starting status poll')

    if (isPollingRef.current) {
      clog('Status poll already active — skipping duplicate')
      return
    }

    isPollingRef.current = true
    const startedAt = Date.now()

    async function pollStatus() {
      if (!isMountedRef.current) return

      const elapsed = Math.round((Date.now() - startedAt) / 1000)

      // ── Timeout guard ──────────────────────────────────────────────────
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clog(`pollStatus TIMEOUT after ${elapsed}s — showing retry UI`)
        isPollingRef.current = false
        if (isMountedRef.current) {
          setTimedOut(true)
          setLoading(false)
        }
        return
      }

      clog(`pollStatus → fetching /api/home/status (elapsed: ${elapsed}s)`)
      try {
        const res = await fetch(getApiUrl('/api/home/status'), { cache: 'no-store' })
        if (!isMountedRef.current) return

        if (!res.ok) {
          clog(`pollStatus → non-OK response (${res.status}) — retrying in ${POLL_INTERVAL_MS}ms`)
          scheduleNextPoll(pollStatus)
          return
        }

        const payload = (await res.json()) as StatusResponse
        if (!isMountedRef.current) return

        clog(`pollStatus → status="${payload.status}" storyCount=${payload.storyCount} ageSeconds=${payload.ageSeconds ?? 'n/a'}`)

        if (payload.status === 'ready') {
          clog('pollStatus → READY — fetching stories')
          isPollingRef.current = false
          await fetchHomeStories()
        } else if (payload.status === 'error') {
          clog('pollStatus → backend error — stopping poll')
          isPollingRef.current = false
          if (isMountedRef.current) {
            setError({ code: 'STATUS_ERROR', message: 'The news backend reported an internal error.' })
            setLoading(false)
          }
        } else {
          // 'refreshing' | 'stale' — keep polling
          const subtitle = payload.status === 'refreshing'
            ? 'Gathering reports and preparing your stories…'
            : 'Looking for the latest coverage…'
          clog(`pollStatus → ${payload.status} — retrying in ${POLL_INTERVAL_MS}ms`)
          if (isMountedRef.current) setLoadingSubtitle(subtitle)
          scheduleNextPoll(pollStatus)
        }
      } catch (err) {
        clog('pollStatus → fetch threw, retrying', err instanceof Error ? err.message : String(err))
        if (isMountedRef.current) scheduleNextPoll(pollStatus)
      }
    }

    pollStatus()

    return () => {
      isMountedRef.current = false
      isPollingRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      if (fetchMoreTimerRef.current) clearTimeout(fetchMoreTimerRef.current)
      clog('NewsClient unmounted — poll cancelled')
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
    clog('fetchHomeStories → calling /api/home')
    const t0 = Date.now()
    try {
      setLoadingSubtitle('Getting your stories ready…')
      const response = await fetch(getApiUrl('/api/home'), { cache: 'no-store' })
      if (!isMountedRef.current) return

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        clog(`fetchHomeStories → non-JSON response (${response.status})`)
        setError({ code: `HTTP_${response.status}`, message: 'Server returned a non-JSON response.' })
        setLoading(false)
        return
      }

      const payload = (await response.json()) as HomeResponse
      if (!isMountedRef.current) return

      clog(`fetchHomeStories → got ${payload.stories?.length ?? 0} stories, status="${payload.status}" (${Date.now() - t0}ms)`)

      if (!response.ok || payload.error) {
        clog('fetchHomeStories → error in payload', payload.error)
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
      clog('fetchHomeStories → threw', err instanceof Error ? err.message : String(err))
      if (isMountedRef.current) {
        setError({
          code: 'HOME_REQUEST_FAILED',
          message: err instanceof Error ? err.message : 'Could not request news feed.',
        })
        setLoading(false)
      }
    }
  }

  async function fetchMore() {
    if (fetchingMore || noMoreStories || cooldownRemaining > 0) return
    clog(`fetchMore → requesting stories at offset=${stories.length}`)
    setFetchingMore(true)
    setMoreError(null)

    const offset = stories.length
    let attempts = 0

    async function pollMore() {
      attempts += 1
      try {
        const response = await fetch(getApiUrl(`/api/home/more?offset=${offset}`), { cache: 'no-store' })
        if (!isMountedRef.current) return

        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          if (isMountedRef.current) {
            setMoreError('Failed to fetch')
            setCooldownRemaining(300)
            setFetchingMore(false)
          }
          return
        }

        const payload = (await response.json()) as MoreResponse
        if (!isMountedRef.current) return

        if (!response.ok || payload.error) {
          if (isMountedRef.current) {
            setMoreError(payload.error?.message ?? 'Failed to fetch')
            setCooldownRemaining(300)
            setFetchingMore(false)
          }
          return
        }

        const incoming = payload.stories ?? []
        const status = payload.status ?? 'ready'

        if (incoming.length > 0) {
          setStories((prev) => {
            const existingIds = new Set(prev.map((s) => s.topic_id))
            const fresh = incoming.filter((s) => !existingIds.has(s.topic_id))
            return [...prev, ...fresh]
          })
          fetchMoreTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) setFetchingMore(false)
          }, 1000)
          return
        }

        if (status === 'processing' && attempts < 8) {
          fetchMoreTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) pollMore()
          }, 1500)
        } else {
          if (isMountedRef.current) {
            setNoMoreStories(true)
            setFetchingMore(false)
          }
        }
      } catch (err) {
        if (!isMountedRef.current) return
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

  function formatStoryDate(date: string) {
    const value = new Date(date)
    if (Number.isNaN(value.getTime())) return 'Date unavailable'
    return `Published ${new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(value)}`
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
            title="Getting the latest stories…"
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
              setLoadingSubtitle('Checking for the latest coverage…')
              isPollingRef.current = true
              // Re-trigger the effect by remounting would require a key trick;
              // instead, directly restart the poll here
              const startedAt = Date.now()
              async function retry() {
                if (!isMountedRef.current) return
                if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                  isPollingRef.current = false
                  if (isMountedRef.current) {
                    setTimedOut(true)
                    setLoading(false)
                  }
                  return
                }
                try {
                  const res = await fetch(getApiUrl('/api/home/status'), { cache: 'no-store' })
                  if (!isMountedRef.current) return
                  const payload = (await res.json()) as StatusResponse
                  if (!isMountedRef.current) return
                  if (payload.status === 'ready') {
                    isPollingRef.current = false
                    await fetchHomeStories()
                  } else if (payload.status === 'error') {
                    isPollingRef.current = false
                    if (isMountedRef.current) {
                      setError({ code: 'STATUS_ERROR', message: 'The news backend reported an internal error.' })
                      setLoading(false)
                    }
                  } else {
                    if (isMountedRef.current) {
                      setLoadingSubtitle(payload.status === 'refreshing'
                        ? 'Gathering reports and preparing your stories…'
                        : 'Looking for the latest coverage…')
                    }
                    timerRef.current = setTimeout(retry, POLL_INTERVAL_MS)
                  }
                } catch {
                  if (isMountedRef.current) {
                    timerRef.current = setTimeout(retry, POLL_INTERVAL_MS)
                  }
                }
              }
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
                  <p className="mt-5 text-xs font-medium text-muted-foreground">
                    {formatStoryDate(story.latest_published_at)}
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
              title="Finding more stories…"
              subtitle="Looking for more coverage"
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
