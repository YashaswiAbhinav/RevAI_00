'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        // Check session and redirect
        const session = await getSession()
        if (session) {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch (error) {
      setError('Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome Back"
      title="Sign in to your workspace"
      subtitle="Access your automation dashboard, comment pipeline, and reporting views from one clean control center."
      alternateHref="/auth/register"
      alternateLabel="create a new account"
      alternateText="Need a workspace?"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              Email
            </span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rev-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-slate-400" />
              Password
            </span>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rev-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="rev-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
          {!isLoading && <ArrowRight className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="rev-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4 text-[color:var(--rev-primary)]" />
          Continue with Google
        </button>

        <p className="text-xs leading-6 text-slate-500">
          By signing in, you can move directly into the dashboard and continue where your automation left off.
        </p>
      </form>
    </AuthShell>
  )
}
