'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { CatalogEntry } from '../../lib/api';

export default function CatalogPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);

  useEffect(() => { api.catalog.list().then(setEntries).catch(() => {}); }, []);

  return (
    <main>
      <h1>API Catalog</h1>
      {entries.length === 0 ? (
        <p>No published APIs yet. <a href="/submit">Submit one →</a></p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {entries.map((e) => (
            <a key={e.apiId} href={`/catalog/${e.apiId}`} style={{ display: 'block', border: '1px solid #ddd', borderRadius: 8, padding: '1rem', textDecoration: 'none', color: 'inherit' }}>
              <h2 style={{ margin: '0 0 0.25rem' }}>{e.name}</h2>
              <p style={{ margin: 0, color: '#555', fontSize: '0.9rem' }}>{e.repositoryUrl}</p>
              <p style={{ margin: '0.25rem 0 0', color: '#888', fontSize: '0.8rem' }}>Published {new Date(e.publishedAt).toLocaleDateString()}</p>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
