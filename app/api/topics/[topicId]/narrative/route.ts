import { NextResponse } from 'next/server'
import { toMosaicError } from '@/lib/mosaic/env'
import { getOrCreateNarrative } from '@/lib/mosaic/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ topicId: string }> }) {
  try {
    const { topicId } = await params
    const narrative = await getOrCreateNarrative(topicId)
    return NextResponse.json({ narrative })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'NARRATIVE_FAILED') }, { status: 500 })
  }
}
