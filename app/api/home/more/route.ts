import { NextResponse } from 'next/server'
import { isCategoryId, DEFAULT_CATEGORY } from '@/lib/mosaic/categories'
import { toMosaicError } from '@/lib/mosaic/env'
import { generateMoreHomepageCards, getCachedHomepage } from '@/lib/mosaic/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const categoryParam = url.searchParams.get('category')
    const offsetParam = url.searchParams.get('offset')

    const category = isCategoryId(categoryParam) ? categoryParam : DEFAULT_CATEGORY
    const offset = Math.max(0, parseInt(offsetParam ?? '0', 10) || 0)

    // Generate cards for any topics that haven't been cached yet (no ingestion triggered)
    await generateMoreHomepageCards(category, 3)

    // Fetch the next page of stories using the caller-supplied offset
    const stories = await getCachedHomepage(category, 3, offset).catch(() => [])

    return NextResponse.json({ stories })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'HOME_MORE_FAILED') }, { status: 500 })
  }
}
