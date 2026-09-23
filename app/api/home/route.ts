import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { toMosaicError } from '@/lib/mosaic/env'
import { getCachedHomepage, refreshHomepageCategory } from '@/lib/mosaic/pipeline'
import { getLastIngestionAt } from '@/lib/mosaic/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ONE_HOUR_MS = 60 * 60 * 1000

export async function GET() {
  try {
    const stories = await getCachedHomepage().catch(() => [] as Awaited<ReturnType<typeof getCachedHomepage>>)

    const lastFetch = await getLastIngestionAt()
    const isStale = !lastFetch || Date.now() - lastFetch.getTime() > ONE_HOUR_MS

    if (isStale || stories.length === 0) {
      // Kick off the heavy pipeline AFTER the response is sent — no timeout risk
      after(async () => {
        await refreshHomepageCategory().catch(() => undefined)
      })
    }

    // Always return whatever is cached right now — client gets an instant response
    // Fresh stories will be ready on the next request once the background job finishes
    return NextResponse.json({ stories })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'HOME_FEED_FAILED') }, { status: 500 })
  }
}
