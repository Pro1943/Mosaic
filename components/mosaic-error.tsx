import type { MosaicError } from '@/lib/mosaic/types'

export function ErrorPanel({ error }: { error: MosaicError }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/70 p-5 text-left">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-800">{error.code}</p>
      <p className="mt-2 text-sm leading-6 text-red-950/75">{error.message}</p>
      {error.details ? (
        <pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-white/70 p-3 text-xs text-red-950/70">{JSON.stringify(error.details, null, 2)}</pre>
      ) : null}
    </div>
  )
}
