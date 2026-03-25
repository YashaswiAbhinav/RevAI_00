import Link from 'next/link'
import { ArrowRight, BarChart3, Bot, MessageSquare, Sparkles, Workflow } from 'lucide-react'

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="rev-orb left-[-6rem] top-[-4rem] h-80 w-80 bg-[radial-gradient(circle,_rgba(255,123,84,0.18),_transparent_68%)]" />
        <div className="rev-orb right-[-5rem] top-[8%] h-96 w-96 bg-[radial-gradient(circle,_rgba(19,186,166,0.18),_transparent_70%)]" />
        <div className="rev-orb bottom-[-10rem] left-[35%] h-[24rem] w-[24rem] bg-[radial-gradient(circle,_rgba(15,23,42,0.12),_transparent_72%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-6">
        <header className="rev-panel-strong flex flex-col gap-5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="rev-kicker">Intelligent Engagement Console</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--rev-primary),var(--rev-primary-strong))] text-white shadow-lg shadow-orange-200">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-950">RevAI</h1>
                <p className="text-sm text-slate-500">Automate comment response workflows with confidence.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/auth/login" className="rev-button-secondary">
              Sign In
            </Link>
            <Link href="/dashboard" className="rev-button-primary">
              Open Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid flex-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rev-panel-strong relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
            <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,_rgba(255,123,84,0.14),_transparent_60%)]" />
            <div className="relative">
              <span className="rev-tag">
                <Sparkles className="h-3.5 w-3.5" />
                Built for automated customer engagement
              </span>
              <h2 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-slate-950 sm:text-6xl">
                Turn comments into queued replies, reports, and calmer workflows.
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                RevAI gives you a focused command center for connecting channels, monitoring content, generating AI-assisted responses, and scheduling the whole pipeline with Airflow.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/auth/register" className="rev-button-primary">
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/dashboard" className="rev-button-secondary">
                  Explore live workspace
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  { value: '3', label: 'Workflow loops', detail: 'Connect, monitor, automate' },
                  { value: '2', label: 'Data stores', detail: 'Postgres + Firestore' },
                  { value: '24/7', label: 'Pipeline posture', detail: 'Ready for DAG-driven automation' },
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-200/70 bg-white/78 p-5 shadow-sm">
                    <p className="text-3xl font-semibold text-slate-950">{item.value}</p>
                    <p className="mt-2 text-sm font-medium text-slate-600">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rev-panel p-6">
              <p className="rev-kicker">Product Story</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-950">A working system, not a slide deck.</h3>
              <div className="mt-6 grid gap-4">
                {[
                  {
                    icon: MessageSquare,
                    title: 'Collect comment streams',
                    description: 'Monitor selected YouTube videos, Reddit threads, and Instagram posts from a single workspace.',
                  },
                  {
                    icon: Workflow,
                    title: 'Route through automation',
                    description: 'Let AI classify and prepare replies, then queue them for scheduled posting.',
                  },
                  {
                    icon: BarChart3,
                    title: 'Read what the audience means',
                    description: 'Track sentiment, top questions, concerns, and activity trends by time range.',
                  },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="flex items-start gap-4 rounded-3xl border border-slate-200/60 bg-white/76 p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rev-panel p-6">
              <p className="rev-kicker">Demo Readiness</p>
              <div className="mt-4 grid gap-3">
                {[
                  'Connect social channels and verify permissions',
                  'Choose monitored content with clear on/off states',
                  'See queued replies and comment status movement',
                  'Present reports without leaving the product flow',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-950/4 px-4 py-3 text-sm text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--rev-secondary)]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
