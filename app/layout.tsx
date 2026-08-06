export const metadata = {
  title: 'POVODYR',
  description: 'Цифровий асистент для українських художників',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  )
}
