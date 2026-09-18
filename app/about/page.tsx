'use client'

import Link from 'next/link'
import { ArrowLeft, GitBranch, Layers3 } from 'lucide-react'
import { Header, Footer } from '@/components/mosaic-shell'

export default function AboutPage() {
  return (
    <div id="top" className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <Link href="/" className="mb-12 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-accent">
          <ArrowLeft size={15} /> Back to home
        </Link>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.72fr)] lg:gap-20">
          <section>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">About Mosaic</p>
            <h1 className="max-w-3xl font-serif text-4xl leading-[1.08] tracking-[-0.04em] md:text-6xl">A clearer view of the news.</h1>
            <div className="mt-8 space-y-7 text-[15px] leading-7 text-muted-foreground">
              <p>Mosaic brings together reporting from across the spectrum and turns it into a single, considered view. Instead of asking you to follow every headline, we show the common ground, the meaningful differences, and the context between them.</p>
              <p>Our summaries are designed to help you read with more confidence. They do not flatten disagreement or pretend that every source sees a story the same way. They make those differences easier to understand.</p>
            </div>
          </section>
          <aside className="space-y-5 lg:pt-16">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><Layers3 size={15} className="text-accent" /> What we show</div>
              <ul className="mt-5 space-y-4 text-sm leading-6 text-muted-foreground">
                <li className="flex gap-3"><GitBranch size={16} className="mt-1 shrink-0 text-accent" /><span>Where coverage agrees on the core facts.</span></li>
                <li className="flex gap-3"><GitBranch size={16} className="mt-1 shrink-0 text-accent" /><span>Where framing and interpretation diverge.</span></li>
                <li className="flex gap-3"><GitBranch size={16} className="mt-1 shrink-0 text-accent" /><span>What remains unresolved or worth watching.</span></li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
