import { NextResponse } from 'next/server'
import { CATEGORIES, DEFAULT_CATEGORY, isCategoryId } from '@/lib/mosaic/categories'
import { toMosaicError } from '@/lib/mosaic/env'
import { getCachedHomepage, ingestAllCategories } from '@/lib/mosaic/pipeline'
import { getLastIngestionAt } from '@/lib/mosaic/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ONE_HOUR_MS = 60 * 60 * 1000

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const categoryParam = url.searchParams.get('category')
    const category = isCategoryId(categoryParam) ? categoryParam : DEFAULT_CATEGORY

    const lastFetch = await getLastIngestionAt(category)
    const isStale = !lastFetch || Date.now() - lastFetch.getTime() > ONE_HOUR_MS

    if (isStale) {
      await ingestAllCategories()
    }

    const stories = await getCachedHomepage(category)

    return NextResponse.json({ categories: CATEGORIES, stories })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'HOME_FEED_FAILED') }, { status: 500 })
  }
}
