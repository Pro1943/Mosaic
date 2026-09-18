'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ExternalLink, GitBranch, Info, Layers3, Percent } from 'lucide-react'
import type { ComparisonAnalysis, MosaicError, NarrativeAnalysis, TopicMeta } from '@/lib/mosaic/types'
import { ErrorPanel } from './mosaic-error'

type TopicResponse = {
  topic?: TopicMeta
  error?: MosaicError
}

type ComparisonResponse = {
  comparison?: ComparisonAnalysis
  error?: MosaicError
}

type NarrativeResponse = {
  narrative?: NarrativeAnalysis
  error?: MosaicError
}

export function ArticleClient({ topicId }: { topicId: string }) {
  const [topic, setTopic] = useState<TopicMeta | null>(null)
  const [comparison, setComparison] = useState<ComparisonAnalysis | null>(null)
  const [narrative, setNarrative] = useState<NarrativeAnalysis | null>(null)
  const [metaError, setMetaError] = useState<MosaicError | null>(null)
  const [comparisonError, setComparisonError] = useState<MosaicError | null>(null)
  const [narrativeError, setNarrativeError] = useState<MosaicError | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function requestJson<T>(url: string): Promise<{ response: Response; payload: T }> {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
      return { response, payload: (await response.json()) as T }
    }

    async function load() {
      try {
        const { response, payload } = await requestJson<TopicResponse>(`/api/topics/${encodeURIComponent(topicId)}`)
        if (!response.ok || payload.error || !payload.topic) {
          setMetaError(payload.error ?? { code: `HTTP_${response.status}`, message: response.statusText })
          return
        }
        setTopic(payload.topic)
      } catch (error) {
        if (!controller.signal.aborted) {
          setMetaError({ code: 'TOPIC_META_REQUEST_FAILED', message: error instanceof Error ? error.message : 'Could not request topic metadata.' })
        }
        return
      }

      try {
        const { response, payload } = await requestJson<ComparisonResponse>(`/api/topics/${encodeURIComponent(topicId)}/comparison`)
        if (!response.ok || payload.error || !payload.comparison) {
          setComparisonError(payload.error ?? { code: `HTTP_${response.status}`, message: response.statusText })
        } else {
          setComparison(payload.comparison)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setComparisonError({ code: 'COMPARISON_REQUEST_FAILED', message: error instanceof Error ? error.message : 'Could not request comparison analysis.' })
        }
      }

      try {
        const { response, payload } = await requestJson<NarrativeResponse>(`/api/topics/${encodeURIComponent(topicId)}/narrative`)
        if (!response.ok || payload.error || !payload.narrative) {
          setNarrativeError(payload.error ?? { code: `HTTP_${response.status}`, message: response.statusText })
        } else {
          setNarrative(payload.narrative)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setNarrativeError({ code: 'NARRATIVE_REQUEST_FAILED', message: error instanceof Error ? error.message : 'Could not request narrative analysis.' })
        }
      }
    }

    load()
    return () => controller.abort()
  }, [topicId])

  if (metaError) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <BackLink />
        <ErrorPanel error={metaError} />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <BackLink />
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.72fr)] lg:gap-20">
        <article>
          {topic ? <SourceChips sources={topic.sources} /> : <div className="h-7 w-36 rounded bg-muted" />}
          {topic ? (
            <>
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.17em] text-accent">
                {topic.category} {topic.published_at ? `/ ${formatDate(topic.published_at)}` : ''}
              </p>
              <h1 className="mt-4 font-serif text-4xl leading-[1.08] tracking-[-0.04em] md:text-6xl">{topic.neutral_headline}</h1>
            </>
          ) : (
            <HeadlineSkeleton />
          )}
          <div className="mt-6 flex items-center gap-2 border-y border-border py-3 text-xs text-muted-foreground">
            <Info size={15} className="text-accent" />
            <span>
              <strong className="font-medium text-foreground">Synthesized overview.</strong> This is not a single published article.
            </span>
          </div>
          <div className="mt-9 space-y-9 text-[15px] leading-7 text-muted-foreground">
            {narrativeError ? <ErrorPanel error={narrativeError} /> : null}
            {!narrative && !narrativeError ? <NarrativeSkeleton /> : null}
            {narrative ? (
              <>
                <p>{narrative.opening_paragraph}</p>
                {narrative.sections.map((section) => (
                  <section key={section.label}>
                    <SectionHeading>{section.label}</SectionHeading>
                    <p>{section.body}</p>
                  </section>
                ))}
                <section className="border-t border-border pt-8">
                  <SectionHeading>Conclusion</SectionHeading>
                  <p>{narrative.conclusion}</p>
                </section>
              </>
            ) : null}
          </div>
        </article>
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start" id="sources">
          <CoverageCard narrative={narrative} />
          <SourcesCard topic={topic} comparison={comparison} error={comparisonError} />
          <DiffersCard narrative={narrative} error={narrativeError} />
        </aside>
      </div>
    </main>
  )
}

function BackLink() {
  return (
    <Link href="/" className="mb-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-accent">
      <ArrowLeft size={15} /> Back to home
    </Link>
  )
}

function SourceChips({ sources }: { sources: TopicMeta['sources'] }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Sources">
      {sources.slice(0, 6).map((source, index) => (
        <a
          key={`${source.url}-${index}`}
          href={source.url}
          title={source.name}
          className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-[10px] font-semibold tracking-wide text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {initials(source.name)}
          <span className="sr-only">Source {index + 1}</span>
        </a>
      ))}
    </div>
  )
}

function CoverageCard({ narrative }: { narrative: NarrativeAnalysis | null }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Percent size={15} className="text-accent" /> Source overlap
      </div>
      {narrative ? (
        <>
          <div className="mt-4 flex items-end gap-3">
            <span className="font-serif text-6xl leading-none tracking-[-0.05em]">{Math.round(narrative.coverage_overlap_percent)}</span>
            <span className="pb-1 font-serif text-3xl text-accent">%</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">of analyzed claims are corroborated across multiple reporting sources.</p>
        </>
      ) : (
        <CardSkeleton lines={3} />
      )}
    </div>
  )
}

function SourcesCard({ topic, comparison, error }: { topic: TopicMeta | null; comparison: ComparisonAnalysis | null; error: MosaicError | null }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Layers3 size={15} className="text-accent" /> Sources reviewed
      </div>
      {error ? <ErrorPanel error={error} /> : null}
      {!topic || (!comparison && !error) ? <CardSkeleton lines={5} /> : null}
      {topic && comparison ? (
        <div className="space-y-5">
          {topic.sources.map((source) => (
            <a key={source.url} href={source.url} className="group flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{source.name}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{sourceFraming(source.name, comparison)}</p>
              </div>
              <ExternalLink size={14} className="mt-0.5 shrink-0 text-muted-foreground transition-colors group-hover:text-accent" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DiffersCard({ narrative, error }: { narrative: NarrativeAnalysis | null; error: MosaicError | null }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-6">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
        <GitBranch size={15} /> Differs on
      </div>
      {error ? <p className="mt-3 text-sm leading-6 text-amber-950/70">{error.code}: {error.message}</p> : null}
      {!narrative && !error ? <CardSkeleton lines={2} /> : null}
      {narrative ? <p className="mt-3 text-sm leading-6 text-amber-950/70">{narrative.differs_on}</p> : null}
      <div className="mt-4 flex items-center gap-2 text-xs text-amber-800">
        <AlertTriangle size={14} /> Difference, not a verdict
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.17em] text-foreground">
      <GitBranch size={15} className="text-accent" />
      {children}
    </h2>
  )
}

function HeadlineSkeleton() {
  return (
    <>
      <div className="mt-7 h-3 w-48 rounded bg-muted" />
      <div className="mt-4 h-12 max-w-3xl rounded bg-muted md:h-16" />
      <div className="mt-3 h-12 max-w-2xl rounded bg-muted md:h-16" />
    </>
  )
}

function NarrativeSkeleton() {
  return (
    <div className="space-y-9" aria-label="Loading article analysis">
      {Array.from({ length: 5 }).map((_, index) => (
        <section key={index}>
          {index > 0 ? <div className="mb-3 h-3 w-48 rounded bg-muted" /> : null}
          <div className="h-4 max-w-2xl rounded bg-muted" />
          <div className="mt-3 h-4 max-w-xl rounded bg-muted" />
          <div className="mt-3 h-4 max-w-lg rounded bg-muted" />
        </section>
      ))}
    </div>
  )
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <div className="mt-4 space-y-3" aria-label="Loading sidebar section">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="h-4 rounded bg-muted" style={{ width: `${90 - index * 9}%` }} />
      ))}
    </div>
  )
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return letters || name.slice(0, 2).toUpperCase()
}

function sourceFraming(source: string, comparison: ComparisonAnalysis) {
  const conflict = comparison.claims.flatMap((claim) => claim.conflicting).find((item) => item.source === source)
  return conflict ? `${conflict.stance} ${conflict.emphasis}` : comparison.overall_note
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value))
}
