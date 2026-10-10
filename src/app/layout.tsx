import type { Metadata } from 'next'
import { Inter, Quicksand } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
})

// Fonte do logotipo "painel".
const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-quicksand',
})

export const metadata: Metadata = {
  title: 'painel',
  description: 'Gestão para revendas de veículos',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={quicksand.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
