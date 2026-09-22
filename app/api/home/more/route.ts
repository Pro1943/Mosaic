import { NextResponse } from 'next/server'
import { toMosaicError } from '@/lib/mosaic/env'
import { generateMoreHomepageCards, getCachedHomepage } from '@/lib/mosaic/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const offsetParam = url.searchParams.get('offset')
    const offset = Math.max(0, parseInt(offsetParam ?? '0', 10) || 0)

    await generateMoreHomepageCards(3).catch(() => [])

    const stories = await getCachedHomepage(3, offset).catch(() => [])

    return NextResponse.json({ stories })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'HOME_MORE_FAILED') }, { status: 500 })
  }
}
