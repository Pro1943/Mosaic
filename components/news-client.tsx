'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Newspaper } from 'lucide-react'
import type { HomeStory, MosaicError } from '@/lib/mosaic/types'
import { ErrorPanel } from './mosaic-error'
import { Loader } from './ui/loader'
import { GradientButton } from './ui/gradient-button'

type HomeResponse = {
  stories?: HomeStory[]
  error?: MosaicError
}

type MoreResponse = {
  stories?: HomeStory[]
  error?: MosaicError
}

export function NewsClient() {
  const [stories, setStories] = useState<HomeStory[]>([])
  const [error, setError] = useState<MosaicError | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingMore, setFetchingMore] = useState(false)
  const [noMoreStories, setNoMoreStories] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0)

  useEffect(() => {
    const controller = new AbortController()
    setNoMoreStories(false)
    setMoreError(null)

    async function loadStories() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/home', {
          signal: controller.signal,
          cache: 'no-store',
        })
        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          setStories([])
          setError({ code: `HTTP_${response.status}`, message: `Server returned non-JSON response (${response.statusText || 'Error'})` })
          return
        }
        const payload = (await response.json()) as HomeResponse

        if (!response.ok || payload.error) {
          setStories([])
          setError(payload.error ?? { code: `HTTP_${response.status}`, message: response.statusText })
          return
        }

        setStories(payload.stories ?? [])
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setStories([])
          setError({
            code: 'HOME_REQUEST_FAILED',
            message: requestError instanceof Error ? requestError.message : 'Could not request the news feed.',
          })
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadStories()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (cooldownRemaining <= 0) return

    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          setMoreError(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [cooldownRemaining])

  async function fetchMore() {
    if (fetchingMore || noMoreStories || cooldownRemaining > 0) return
    setFetchingMore(true)
    setMoreError(null)

    try {
      const offset = stories.length
      const response = await fetch(`/api/home/more?offset=${offset}`, {
        cache: 'no-store',
      })
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        setMoreError('Failed to fetch')
        setCooldownRemaining(300)
        return
      }
      const payload = (await response.json()) as MoreResponse

      if (!response.ok || payload.error) {
        setMoreError(payload.error?.message ?? 'Failed to fetch')
        setCooldownRemaining(300)
        return
      }

      const incoming = payload.stories ?? []
      if (incoming.length === 0) {
        setNoMoreStories(true)
        return
      }

      const existingIds = new Set(stories.map((s) => s.topic_id))
      const fresh = incoming.filter((s) => !existingIds.has(s.topic_id))
      setStories((prev) => [...prev, ...fresh])

      if (fresh.length === 0) {
        setNoMoreStories(true)
      }
    } catch (err) {
      setMoreError(err instanceof Error ? err.message : 'Failed to fetch')
      setCooldownRemaining(300)
    } finally {
      setFetchingMore(false)
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <main id="latest" className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <div className="mb-8 flex items-end justify-between border-b border-border pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Latest Feed</p>
          <h1 className="mt-2 font-serif text-3xl tracking-[-0.03em] md:text-4xl">News Stories</h1>
        </div>
        <span className="hidden text-xs text-muted-foreground sm:block">Updated throughout the day</span>
      </div>

      {loading ? (
        <div className="py-12">
          <Loader
            title="Fetching API's..."
            subtitle="Communicating with database and fetching latest coverage"
            size="lg"
          />
        </div>
      ) : null}

      {!loading && error ? <ErrorPanel error={error} /> : null}

      {!loading && !error ? (
        <div className="grid gap-4">
          {stories.map((story, index) => (
            <Link
              key={story.topic_id}
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
          ))}
        </div>
      ) : null}

      {!loading && !error && (
        <div className="mt-10 flex flex-col items-center gap-3">
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
        </div>
      )}
    </main>
  )
}
