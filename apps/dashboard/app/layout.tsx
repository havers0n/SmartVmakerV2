import type { Metadata } from 'next';
import { QueryProvider } from '@/src/providers/query-client';

export const metadata: Metadata = {
  title: 'Scrimspec Dashboard',
  description: 'YouTube ingestion and video analysis dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <header style={{ borderBottom: '1px solid #ccc', padding: '1rem' }}>
            <h1>Scrimspec Dashboard</h1>
            <nav>
              <ul style={{ listStyle: 'none', display: 'flex', gap: '2rem' }}>
                <li><a href="/">Home</a></li>
                <li><a href="/ingest">Ingest Videos</a></li>
                <li><a href="/analysis">Analyze Videos</a></li>
                <li><a href="/generation">Generate Content</a></li>
              </ul>
            </nav>
          </header>

          <main style={{ padding: '2rem' }}>
            {children}
          </main>

          <footer style={{ borderTop: '1px solid #ccc', padding: '1rem', marginTop: '2rem', textAlign: 'center', color: '#666' }}>
            <p>&copy; 2025 Scrimspec. All rights reserved.</p>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}
