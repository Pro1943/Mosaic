'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { AlertTriangle, Home, Newspaper, RotateCcw } from 'lucide-react'
import { Footer, Header } from '@/components/mosaic-shell'
import { GradientButton } from '@/components/ui/gradient-button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex flex-1 items-center justify-center px-5 py-16 md:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-xl text-center"
        >
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500">
            <AlertTriangle size={32} />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">APPLICATION_ERROR</p>

          <h1 className="mt-3 font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            An Unexpected Error Occurred
          </h1>

          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {error.message || 'A critical application error occurred while rendering this page.'}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/">
              <GradientButton
                variant="purple"
                label="Back to Home"
                icon={<Home size={16} />}
              />
            </Link>
            <Link href="/news">
              <GradientButton
                variant="teal"
                label="News Feed"
                icon={<Newspaper size={16} />}
              />
            </Link>
            <GradientButton
              variant="orange"
              label="Try Again"
              icon={<RotateCcw size={16} />}
              onClick={() => reset()}
            />
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  )
}
