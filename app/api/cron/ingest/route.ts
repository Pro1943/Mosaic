import { NextResponse } from 'next/server'
import { getOptionalEnv, toMosaicError } from '@/lib/mosaic/env'
import { ingestAllCategories } from '@/lib/mosaic/pipeline'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  try {
    const secret = getOptionalEnv('CRON_SECRET')
    const auth = request.headers.get('authorization')

    if (secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: { code: 'CRON_UNAUTHORIZED', message: 'Invalid cron authorization token.' } },
        { status: 401 },
      )
    }

    const result = await ingestAllCategories()
    return NextResponse.json({ result })
  } catch (error) {
    return NextResponse.json({ error: toMosaicError(error, 'CRON_INGEST_FAILED') }, { status: 500 })
  }
}
