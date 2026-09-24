import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { toMosaicError } from '@/lib/mosaic/env'
import { getCachedHomepage, refreshSegment } from '@/lib/mosaic/pipeline'
import { getLastIngestionAt } from '@/lib/mosaic/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STALE_MS = 15 * 60 * 1000

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const segmentParam = searchParams.get('segment') || 'all'
    const segment = (segmentParam === 'initial' ? 'initial' : segmentParam === 'rest' ? 'rest' : 'all') as 'initial' | 'rest' | 'all'

    let stories = await getCachedHomepage().catch(() => [] as Awaited<ReturnType<typeof getCachedHomepage>>)
    const lastFetch = await getLastIngestionAt()
    const isStale = !lastFetch || Date.now() - lastFetch.getTime() > STALE_MS || stories.length < 5

    if (stories.length < 5 || isStale) {
      if (segment === 'initial' || stories.length === 0) {
        await refreshSegment('initial').catch(() => undefined)
        stories = await getCachedHomepage().catch(() => [])
      }

      after(async () => {
        await refreshSegment(segment === 'initial' ? 'rest' : segment).catch(() => undefined)
      })
    }

    const status = stories.length === 0 ? 'processing' : isStale ? 'refreshing' : 'ready'

    return NextResponse.json({ stories, status })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'HOME_FEED_FAILED') }, { status: 500 })
  }
}
