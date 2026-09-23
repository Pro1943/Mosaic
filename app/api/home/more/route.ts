import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { toMosaicError } from '@/lib/mosaic/env'
import { generateMoreHomepageCards, getCachedHomepage } from '@/lib/mosaic/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const offsetParam = url.searchParams.get('offset')
    const offset = Math.max(0, parseInt(offsetParam ?? '0', 10) || 0)

    const stories = await getCachedHomepage(3, offset).catch(() => [])

    if (stories.length === 0) {
      after(async () => {
        await generateMoreHomepageCards(3).catch(() => [])
      })
      return NextResponse.json({ stories: [], status: 'processing' })
    }

    return NextResponse.json({ stories, status: 'ready' })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'HOME_MORE_FAILED') }, { status: 500 })
  }
}
