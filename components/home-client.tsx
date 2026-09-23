'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, GitBranch, Layers3, Percent, ShieldCheck } from 'lucide-react'
import { TypewriterTitle } from './typewriter-title'
import { GradientButton } from './ui/gradient-button'

export function HomeClient() {
  useEffect(() => {
    fetch('/api/home?segment=initial', { cache: 'no-store' }).catch(() => undefined)
  }, [])

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-background via-card/50 to-background py-16 md:py-28">
        <div className="mx-auto max-w-5xl px-5 text-center md:px-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            A Clearer View of the News
          </p>
          <TypewriterTitle
            sequences={[
              { text: 'Mosaic', deleteAfter: true, pauseAfter: 2200 },
              { text: 'Because one perspective never tells the whole story.', deleteAfter: true, pauseAfter: 3500 },
            ]}
            typingSpeed={45}
            deleteSpeed={25}
            startDelay={300}
            loopDelay={1200}
          />
          <p className="mx-auto -mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Mosaic brings together reporting from across the media spectrum, mapping out common ground, highlighting differences, and giving you the complete picture.
          </p>
          <div className="mt-10 flex items-center justify-center">
            <Link href="/news">
              <GradientButton
                variant="teal"
                label="Read The News"
                icon={<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
              />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.72fr)] lg:gap-20">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                About Mosaic
              </p>
              <h2 className="font-serif text-3xl leading-tight tracking-[-0.03em] text-foreground sm:text-4xl md:text-5xl">
                Understanding the news shouldn't require reading ten different sites.
              </h2>
              <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground">
                <p>
                  Every media outlet brings its own lens, emphasis, and framing to breaking stories. Reading a single source often leaves you with only a fragment of the truth.
                </p>
                <p>
                  Mosaic automatically collects coverage across diverse reporting outlets and turns it into a single, considered analysis. Instead of flattening disagreement or pretending every source sees a story the same way, we make those differences transparent and accessible.
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-5">
              <div className="rounded-2xl border border-border bg-card p-7 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <Layers3 size={16} className="text-accent" /> What Mosaic Delivers
                </div>
                <ul className="mt-6 space-y-5 text-sm text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
                    <span>Fact consensus identified across independent sources.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <GitBranch size={18} className="mt-0.5 shrink-0 text-accent" />
                    <span>Framing and key narrative divergences made clear.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Percent size={18} className="mt-0.5 shrink-0 text-accent" />
                    <span>Source overlap percentages calculated objectively.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/40 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              How It Works
            </p>
            <h2 className="font-serif text-3xl tracking-[-0.03em] text-foreground sm:text-4xl">
              Three steps to a clearer perspective
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Layers3 size={20} />
              </div>
              <h3 className="font-serif text-xl font-medium tracking-tight text-foreground">
                1. Gather Coverage
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We ingest real-time news articles covering the same global events across multiple independent reporting outlets.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <GitBranch size={20} />
              </div>
              <h3 className="font-serif text-xl font-medium tracking-tight text-foreground">
                2. Cross-Compare Claims
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Our analysis engine maps reported claims to separate agreed-upon facts from differing stances, framing, and tone.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-8">
              <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Percent size={20} />
              </div>
              <h3 className="font-serif text-xl font-medium tracking-tight text-foreground">
                3. Synthesize Insights
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We present a balanced narrative along with source overlap metrics and direct links back to original reporting.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-5 text-center md:px-8">
          <h2 className="font-serif text-3xl tracking-[-0.03em] text-foreground sm:text-4xl md:text-5xl">
            Explore stories from every angle today.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base text-muted-foreground">
            Dive straight into current coverage and see where sources agree, differ, and reveal the full story.
          </p>
          <div className="mt-9">
            <Link href="/news">
              <GradientButton
                variant="teal"
                label="Read The News"
                icon={<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
              />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
