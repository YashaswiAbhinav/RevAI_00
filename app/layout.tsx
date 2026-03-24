import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import { SessionProvider } from '@/components/SessionProvider'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RevAI - Intelligent Social Media Auto-Response',
  description: 'Automate customer engagement on YouTube, Instagram, and Facebook with AI-powered responses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
