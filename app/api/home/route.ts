import { NextResponse } from 'next/server'
import { CATEGORIES, DEFAULT_CATEGORY, isCategoryId } from '@/lib/mosaic/categories'
import { toMosaicError } from '@/lib/mosaic/env'
import { getCachedHomepage, refreshHomepageCategory } from '@/lib/mosaic/pipeline'
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

    let stories = await getCachedHomepage(category).catch(() => [] as ReturnType<typeof getCachedHomepage> extends Promise<infer U> ? U : never)

    const lastFetch = await getLastIngestionAt(category)
    const isStale = !lastFetch || Date.now() - lastFetch.getTime() > ONE_HOUR_MS

    if (isStale || stories.length === 0) {
      await refreshHomepageCategory(category)
      stories = await getCachedHomepage(category)
    }

    return NextResponse.json({ categories: CATEGORIES, stories })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'HOME_FEED_FAILED') }, { status: 500 })
  }
}
