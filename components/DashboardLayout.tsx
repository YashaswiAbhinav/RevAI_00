'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  Link2,
  LogOut,
  MessageCircle,
  Settings,
  PlaySquare,
  Workflow,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Connections', href: '/dashboard/connections', icon: Link2 },
  { name: 'Content', href: '/dashboard/content', icon: PlaySquare },
  { name: 'Comments', href: '/dashboard/comments', icon: MessageCircle },
  { name: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rev-panel flex items-center gap-4 px-8 py-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Preparing workspace</p>
            <p className="text-sm text-slate-500">Loading your dashboard shell...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="rev-orb left-[-8rem] top-[-4rem] h-96 w-96 bg-[radial-gradient(circle,_rgba(255,123,84,0.15),_transparent_70%)]" />
        <div className="rev-orb right-[-8rem] top-[18%] h-[28rem] w-[28rem] bg-[radial-gradient(circle,_rgba(19,186,166,0.15),_transparent_72%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:px-8">
        <aside className="rev-panel-strong flex w-full flex-col justify-between p-4 lg:sticky lg:top-4 lg:min-h-[calc(100vh-2rem)] lg:w-[290px] lg:self-start">
          <div>
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,var(--rev-primary),var(--rev-primary-strong))] text-white shadow-lg shadow-orange-200">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="rev-kicker">Automation Console</p>
                <h1 className="text-xl font-semibold text-slate-950">RevAI</h1>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Live workspace
              <Workflow className="ml-auto h-4 w-4 text-[#ff9f7f]" />
            </div>

            <nav className="mt-6 grid gap-2">
              {navigation.map((item) => {
                const Icon = item.icon
                const current = pathname === item.href

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium ${
                      current
                        ? 'bg-[linear-gradient(135deg,rgba(255,123,84,0.16),rgba(255,123,84,0.08))] text-slate-950 shadow-sm'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                        current ? 'bg-white text-[color:var(--rev-primary-strong)]' : 'bg-slate-900/5 text-slate-500 group-hover:bg-slate-900/8'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      {item.name}
                    </span>
                    <span className={`h-2.5 w-2.5 rounded-full transition ${current ? 'bg-[color:var(--rev-primary-strong)]' : 'bg-transparent group-hover:bg-slate-300'}`} />
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-slate-200/70 bg-white/80 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <span className="text-sm font-semibold">
                  {(session?.user?.name || session?.user?.email || 'R').slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{session?.user?.name || 'RevAI User'}</p>
                <p className="truncate text-sm text-slate-500">{session?.user?.email}</p>
              </div>
            </div>

            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="rev-button-secondary mt-4 w-full"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
          <div className="rev-panel-strong flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="rev-kicker">Workspace</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {navigation.find((item) => item.href === pathname)?.name || 'Dashboard'}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white/75 px-4 py-2 text-sm text-slate-600">
                {session?.user?.email}
              </div>
              <Link href="/dashboard/settings" className="rev-button-secondary">
                Settings
              </Link>
            </div>
          </div>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  )
}
