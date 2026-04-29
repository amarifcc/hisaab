import type { Metadata, Viewport } from 'next'
import PwaRegister from '@/components/PwaRegister'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hisaab',
  description: 'Renovation expense tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hisaab',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e40af',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    try {
      var theme = localStorage.getItem('hisaab_theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (_) {}
  `

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-slate-50">
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
