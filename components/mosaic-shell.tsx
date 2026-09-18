'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

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
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5 md:px-8">
          <div className="flex items-center gap-5">
            <Logo />
            <p className="hidden pt-[3px] text-sm leading-none text-muted-foreground md:block">Because one perspective never tells the whole story.</p>
          </div>
          <nav className="hidden items-center gap-6 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:flex">
            <Link href="/" className="transition-colors hover:text-accent">
              Home
            </Link>
            <Link href="/about" className="transition-colors hover:text-accent">
              About
            </Link>
          </nav>
          <button
            onClick={() => setIsOpen(true)}
            className="text-muted-foreground transition-colors hover:text-foreground md:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col border-l border-border bg-card p-6 shadow-2xl transition-transform"
          >
            <div className="flex items-center justify-between border-b border-border pb-5">
              <Logo />
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="mt-8 flex flex-col gap-3">
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted hover:text-accent"
              >
                Home
              </Link>
              <Link
                href="/about"
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-muted hover:text-accent"
              >
                About
              </Link>
            </nav>

            <div className="mt-auto border-t border-border pt-6">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Because one perspective never tells the whole story.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
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
