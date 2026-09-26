import { Info } from 'lucide-react'
import type { MosaicError } from '@/lib/mosaic/types'

export function ErrorPanel({ error }: { error: MosaicError }) {
  const isLimitedClaims =
    error.code === 'SOURCE_CLAIMS_EMPTY' ||
    error.code === 'INSUFFICIENT_TOPIC_SOURCES' ||
    error.code === 'NARRATIVE_EMPTY_DIFFERENCES' ||
    error.code === 'COMPARISON_EMPTY_CLAIMS'

  if (isLimitedClaims) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-left shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          <Info size={16} /> Limited Perspective
        </div>
        <h3 className="mt-3 font-serif text-lg font-medium text-foreground">
          Insufficient Comparative Data
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This topic does not currently have enough distinct factual claims reported across multiple independent news outlets to synthesize a comparative breakdown.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/70 p-5 text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-800">{error.code}</p>
      <p className="mt-2 text-sm leading-6 text-red-950/75">{error.message}</p>
    </div>
  )
}
