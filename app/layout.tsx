import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'POVODYR — Персональний помічник',
  description: 'Персональний помічник пошуку можливостей',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/Logo(192x192).png', sizes: '192x192', type: 'image/png' },
      { url: '/Logo(512x512).png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/Logo(192x192).png',
    apple: [
      { url: '/Logo(192x192).png', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'POVODYR',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk">
      <head>
        <link rel="apple-touch-icon" href="/Logo(192x192).png" />
      </head>
      <body>{children}</body>
    </html>
  )
}
