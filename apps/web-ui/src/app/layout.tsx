import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Metadata Catalog',
  description: 'Automated API documentation and catalog',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '1rem 2rem', maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto' }}>
        <nav style={{ borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem' }}>
          <a href="/" style={{ fontWeight: 700, fontSize: '1.1rem' }}>API Catalog</a>
          <a href="/submit">Submit Repo</a>
          <a href="/extractions">Extractions</a>
          <a href="/reviews">Reviews</a>
          <a href="/catalog">Catalog</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
