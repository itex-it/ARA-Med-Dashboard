import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ARA-MED Dashboard',
  description: 'Multi-Tenant Voice AI Plattform für medizinische Ordinationen',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
