'use client'

import { ArrowLeft, GitBranch, Layers3, Search } from 'lucide-react'

function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5 text-foreground">
      <span className="grid size-7 grid-cols-2 gap-0.5" aria-hidden="true">
        <span className="rounded-[3px] bg-accent" />
        <span className="rounded-[3px] bg-foreground/80" />
        <span className="rounded-[3px] bg-foreground/80" />
        <span className="rounded-[3px] bg-accent" />
      </span>
      <span className="font-serif text-2xl tracking-[-0.04em]">Mosaic<span className="text-accent">.</span></span>
    </a>
  )
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5 md:px-8">
          <div className="flex items-center gap-5">
            <Logo />
            <p className="hidden text-sm text-muted-foreground md:block">Because one perspective never tells the whole story.</p>
          </div>
          <nav className="hidden items-center gap-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:flex">
            <a href="/" className="transition-colors hover:text-accent">Home</a>
            <a href="/about" className="text-accent">About</a>
            <button className="transition-colors hover:text-accent" aria-label="Search"><Search size={16} /></button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <a href="/" className="mb-12 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-accent">
          <ArrowLeft size={15} /> Back to home
        </a>
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

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-border px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
        <span className="font-serif text-base text-foreground">Mosaic<span className="text-accent">.</span></span>
        <span>A clearer view of the news.</span>
      </footer>
    </div>
  )
}
