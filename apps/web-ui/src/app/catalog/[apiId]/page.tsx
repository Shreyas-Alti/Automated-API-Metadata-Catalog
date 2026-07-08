'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

interface ApiDetail {
  api: { name: string; hostUrl?: string };
  endpoints: Array<{ id: string; method: string; path: string; summary?: string }>;
  openApiDoc: unknown;
}

export default function CatalogDetailPage({ params }: { params: { apiId: string } }) {
  const [detail, setDetail] = useState<ApiDetail | null>(null);

  useEffect(() => { api.catalog.get(params.apiId).then(setDetail).catch(() => {}); }, [params.apiId]);

  if (!detail) return <p>Loading…</p>;

  return (
    <main>
      <h1>{detail.api.name}</h1>
      {detail.api.hostUrl && <p><strong>Host:</strong> <a href={detail.api.hostUrl}>{detail.api.hostUrl}</a></p>}

      <h2>Endpoints ({detail.endpoints.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Method', 'Path', 'Summary'].map((h) => <th key={h} style={{ textAlign: 'left', borderBottom: '2px solid #ddd', padding: '0.5rem' }}>{h}</th>)}</tr></thead>
        <tbody>
          {detail.endpoints.map((ep) => (
            <tr key={ep.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', fontWeight: 700, color: ep.method === 'GET' ? '#090' : ep.method === 'POST' ? '#06c' : '#c00' }}>{ep.method}</td>
              <td style={{ padding: '0.5rem' }}><code>{ep.path}</code></td>
              <td style={{ padding: '0.5rem' }}>{ep.summary ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details style={{ marginTop: '2rem' }}>
        <summary style={{ cursor: 'pointer' }}>View raw OpenAPI document</summary>
        <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto', borderRadius: 8, marginTop: '0.5rem', fontSize: '0.8rem' }}>
          {JSON.stringify(detail.openApiDoc, null, 2)}
        </pre>
      </details>
    </main>
  );
}
