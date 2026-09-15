import { NextResponse } from 'next/server'
import { CATEGORIES, DEFAULT_CATEGORY, isCategoryId } from '@/lib/mosaic/categories'
import { toMosaicError } from '@/lib/mosaic/env'
import { getCachedHomepage } from '@/lib/mosaic/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const categoryParam = url.searchParams.get('category')
    const category = isCategoryId(categoryParam) ? categoryParam : DEFAULT_CATEGORY
    const stories = await getCachedHomepage(category)

    return NextResponse.json({ categories: CATEGORIES, stories })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'HOME_FEED_FAILED') }, { status: 500 })
  }
}
