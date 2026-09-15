'use client'

import Link from 'next/link'
import { Menu, Search } from 'lucide-react'

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-foreground">
      <span className="grid size-7 grid-cols-2 gap-0.5" aria-hidden="true">
        <span className="rounded-[3px] bg-accent" />
        <span className="rounded-[3px] bg-foreground/80" />
        <span className="rounded-[3px] bg-foreground/80" />
        <span className="rounded-[3px] bg-accent" />
      </span>
      <span className="font-serif text-2xl tracking-[-0.04em]">
        Mosaic<span className="text-accent">.</span>
      </span>
    </Link>
  )
}

export function Header() {
  return (
    <header className="border-b border-border bg-background/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5 md:px-8">
        <div className="flex items-center gap-5">
          <Logo />
          <p className="hidden text-sm text-muted-foreground md:block">Because one perspective never tells the whole story.</p>
        </div>
        <nav className="hidden items-center gap-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:flex">
          <Link href="/" className="transition-colors hover:text-accent">
            Home
          </Link>
          <Link href="/about" className="transition-colors hover:text-accent">
            About
          </Link>
          <button className="transition-colors hover:text-accent" aria-label="Search">
            <Search size={16} />
          </button>
        </nav>
        <button className="text-muted-foreground md:hidden" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-border px-5 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
      <span className="font-serif text-base text-foreground">
        Mosaic<span className="text-accent">.</span>
      </span>
      <span id="about">A clearer view of the news.</span>
    </footer>
  )
}
