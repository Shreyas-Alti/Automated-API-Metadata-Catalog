export default function HomePage() {
  return (
    <main>
      <h1>API Metadata Catalog</h1>
      <p>Submit a repository, review the extracted API endpoints, and publish to the catalog.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '2rem' }}>
        {[
          { href: '/submit', title: '1. Submit', desc: 'Point the extractor at a GitHub repo.' },
          { href: '/reviews', title: '2. Review', desc: 'Verify and edit extracted endpoint metadata.' },
          { href: '/catalog', title: '3. Browse', desc: 'Explore the published API catalog.' },
        ].map((card) => (
          <a key={card.href} href={card.href} style={{ display: 'block', border: '1px solid #ddd', borderRadius: 8, padding: '1.5rem', textDecoration: 'none', color: 'inherit' }}>
            <h2 style={{ marginTop: 0 }}>{card.title}</h2>
            <p style={{ color: '#555', margin: 0 }}>{card.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
