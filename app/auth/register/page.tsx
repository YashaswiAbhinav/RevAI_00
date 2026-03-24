'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowRight, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Registration failed')
        return
      }

      // Registration successful, sign in the user
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setError('Registration successful, but sign in failed. Please try logging in.')
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch (error) {
      setError('Failed to sign up with Google')
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Create Workspace"
      title="Set up your RevAI account"
      subtitle="Start with a polished control center for monitored content, automation settings, and engagement analytics."
      alternateHref="/auth/login"
      alternateLabel="sign in"
      alternateText="Already have an account?"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4 text-slate-400" />
              Full name
            </span>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="rev-input"
              placeholder="Your name"
              value={formData.name}
              onChange={handleInputChange}
            />
          </label>

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
              value={formData.email}
              onChange={handleInputChange}
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
              autoComplete="new-password"
              required
              className="rev-input"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={handleInputChange}
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-slate-400" />
              Confirm password
            </span>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="rev-input"
              placeholder="Repeat your password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
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
          {isLoading ? 'Creating account...' : 'Create account'}
          {!isLoading && <ArrowRight className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isLoading}
          className="rev-button-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4 text-[color:var(--rev-primary)]" />
          Continue with Google
        </button>
      </form>
    </AuthShell>
  )
}
