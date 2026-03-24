'use client'

import Link from 'next/link'
import { BarChart3, Bot, MessageSquare, Workflow } from 'lucide-react'

interface AuthShellProps {
  eyebrow: string
  title: string
  subtitle: string
  alternateHref: string
  alternateLabel: string
  alternateText: string
  children: React.ReactNode
}

const highlights = [
  {
    icon: MessageSquare,
    title: 'Reply with context',
    description: 'Generate human-sounding replies that fit your brand voice and audience.',
  },
  {
    icon: Workflow,
    title: 'Automate the pipeline',
    description: 'Move from comment fetch to queued posting without manual busywork.',
  },
  {
    icon: BarChart3,
    title: 'Understand sentiment',
    description: 'See patterns in customer concerns, praise, and recurring questions.',
  },
]

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  alternateHref,
  alternateLabel,
  alternateText,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),_rgba(255,255,255,0.7)_42%,_rgba(247,248,252,0.96)_100%)]">
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-4 py-6 sm:px-6 lg:flex-row lg:items-stretch lg:gap-12 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="rev-orb left-[-8rem] top-[-5rem] h-72 w-72 bg-[radial-gradient(circle,_rgba(255,123,84,0.24),_transparent_68%)]" />
          <div className="rev-orb right-[-7rem] top-[10%] h-80 w-80 bg-[radial-gradient(circle,_rgba(19,186,166,0.18),_transparent_68%)]" />
          <div className="rev-orb bottom-[-7rem] left-[30%] h-80 w-80 bg-[radial-gradient(circle,_rgba(13,22,45,0.12),_transparent_70%)]" />
        </div>

        <section className="flex flex-1 flex-col justify-between rounded-[2rem] border border-white/60 bg-[#0f172a] px-6 py-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] sm:px-8 lg:px-10">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium tracking-[0.24em] text-white/72 uppercase">
              <Bot className="h-4 w-4" />
              RevAI
            </Link>

            <div className="mt-10 max-w-xl">
              <p className="rev-kicker !text-white/60">{eyebrow}</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Build the reply engine, not just the reply.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
                RevAI turns monitored content into an operating console for engagement, automation, and reporting across the social channels that matter.
              </p>
            </div>

            <div className="mt-10 grid gap-4">
              {highlights.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#ff8a5b]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{item.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
            Built for a fast-moving demo, but structured like a real automation product.
          </div>
        </section>

        <section className="flex w-full max-w-xl flex-col justify-center lg:min-h-[calc(100vh-3rem)]">
          <div className="rev-panel px-6 py-8 sm:px-8 sm:py-10">
            <p className="rev-kicker">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">{subtitle}</p>
            <p className="mt-4 text-sm text-slate-500">
              {alternateText}{' '}
              <Link href={alternateHref} className="font-semibold text-[color:var(--rev-primary)] transition hover:text-[color:var(--rev-primary-strong)]">
                {alternateLabel}
              </Link>
            </p>

            <div className="mt-8">{children}</div>
          </div>
        </section>
      </div>
    </div>
  )
}
