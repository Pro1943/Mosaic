'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2, Newspaper } from 'lucide-react'
import { CATEGORIES, DEFAULT_CATEGORY } from '@/lib/mosaic/categories'
import type { CategoryId, HomeStory, MosaicError } from '@/lib/mosaic/types'
import { ErrorPanel } from './mosaic-error'

type HomeResponse = {
  stories?: HomeStory[]
  error?: MosaicError
}

type MoreResponse = {
  stories?: HomeStory[]
  error?: MosaicError
}


export function HomeClient() {
  const [category, setCategory] = useState<CategoryId>(DEFAULT_CATEGORY)
  const [stories, setStories] = useState<HomeStory[]>([])
  const [error, setError] = useState<MosaicError | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingMore, setFetchingMore] = useState(false)
  const [noMoreStories, setNoMoreStories] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    // Reset "more" state whenever the category changes
    setNoMoreStories(false)
    setMoreError(null)

    async function loadStories() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/home?category=${category}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
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
            message: requestError instanceof Error ? requestError.message : 'Could not request the Mosaic homepage feed.',
          })
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    loadStories()
    return () => controller.abort()
  }, [category])

  async function fetchMore() {
    if (fetchingMore || noMoreStories) return
    setFetchingMore(true)
    setMoreError(null)

    try {
      const offset = stories.length
      const response = await fetch(`/api/home/more?category=${category}&offset=${offset}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as MoreResponse

      if (!response.ok || payload.error) {
        setMoreError(payload.error?.message ?? 'Could not load more stories.')
        return
      }

      const incoming = payload.stories ?? []
      if (incoming.length === 0) {
        setNoMoreStories(true)
        return
      }

      // Deduplicate by topic_id before appending
      const existingIds = new Set(stories.map((s) => s.topic_id))
      const fresh = incoming.filter((s) => !existingIds.has(s.topic_id))
      setStories((prev) => [...prev, ...fresh])

      if (fresh.length === 0) {
        setNoMoreStories(true)
      }
    } catch (err) {
      setMoreError(err instanceof Error ? err.message : 'Could not load more stories.')
    } finally {
      setFetchingMore(false)
    }
  }


  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">A clearer view of the news</p>
          <h1 className="max-w-3xl font-serif text-4xl leading-[1.08] tracking-[-0.04em] text-foreground md:text-6xl">
            Stories, considered from every angle.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
            Mosaic brings together coverage from across the spectrum, showing where sources agree, where they differ, and what the full picture looks like.
          </p>
        </div>
      </section>
      <main id="latest" className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="border-b border-border pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Categories</p>
            <div className="mt-4 grid gap-2">
              {CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    category === item.id ? 'border-accent bg-card text-accent' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section>
          <div className="mb-7 flex items-end justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Today</p>
              <h2 className="mt-2 font-serif text-2xl tracking-[-0.02em]">The latest stories</h2>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:block">Updated throughout the day</span>
          </div>
          {loading ? <HomeSkeleton /> : null}
          {!loading && error ? <ErrorPanel error={error} /> : null}
          {!loading && !error ? (
            <div className="grid gap-3">
              {stories.map((story, index) => (
                <Link
                  key={story.topic_id}
                  href={`/article/${encodeURIComponent(story.topic_id)}`}
                  className="group grid w-full gap-6 rounded-xl border border-border bg-card p-6 text-left transition-colors hover:border-foreground/40 md:grid-cols-[1fr_auto] md:items-center md:p-7"
                >
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{story.sources_preview.map((source) => source.name).slice(0, 3).join(' / ')}</span>
                      <span aria-hidden="true">/</span>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 className="max-w-2xl font-serif text-2xl leading-tight tracking-[-0.025em] text-foreground transition-colors group-hover:text-accent md:text-[27px]">
                      {story.neutral_headline}
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{story.snippet}</p>
                  </div>
                  <div className="flex items-center gap-2 self-end whitespace-nowrap text-xs font-medium text-muted-foreground md:self-center">
                    <Newspaper size={15} strokeWidth={1.6} />
                    <span>{story.source_count} sources</span>
                    <ChevronRight size={16} className="ml-2 text-accent transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
          {!loading && !error && (
            <div className="mt-6 flex flex-col items-center gap-3">
              {moreError && (
                <p className="text-sm text-destructive">{moreError}</p>
              )}
              <button
                onClick={fetchMore}
                disabled={fetchingMore || noMoreStories}
                className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fetchingMore ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Loading more…
                  </>
                ) : noMoreStories ? (
                  'No more stories available'
                ) : (
                  'Fetch more stories'
                )}
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  )
}

function HomeSkeleton() {
  return (
    <div className="grid gap-3" aria-label="Loading stories">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid gap-6 rounded-xl border border-border bg-card/60 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div>
            <div className="mb-4 h-3 w-44 rounded bg-muted" />
            <div className="h-8 max-w-2xl rounded bg-muted" />
            <div className="mt-3 h-4 max-w-xl rounded bg-muted" />
            <div className="mt-2 h-4 max-w-lg rounded bg-muted" />
          </div>
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
