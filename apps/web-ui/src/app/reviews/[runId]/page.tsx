'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { Endpoint } from '../../../lib/api';

export default function ReviewDetailPage({ params }: { params: { runId: string } }) {
  const [data, setData] = useState<{ run: { id: string; repositoryUrl: string; status: string }; endpoints: Endpoint[] } | null>(null);
  const [editing, setEditing] = useState<{ endpointId: string; field: string; value: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    api.reviews.get(params.runId).then((d) => setData(d as typeof data)).catch(() => {});
  }, [params.runId]);

  const saveEdit = async () => {
    if (!editing) return;
    await api.reviews.editEndpoint(params.runId, editing.endpointId, editing.field, editing.value);
    setEditing(null);
    // Refresh
    api.reviews.get(params.runId).then((d) => setData(d as typeof data)).catch(() => {});
  };

  const publish = async () => {
    setPublishing(true);
    await api.reviews.publish(params.runId);
    setPublished(true);
    setPublishing(false);
  };

  if (!data) return <p>Loading…</p>;

  return (
    <main>
      <h1>Review: {data.run.repositoryUrl}</h1>
      {published && <div style={{ background: '#f0fff0', border: '1px solid #0a0', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>✅ Published! <a href="/catalog">View in catalog →</a></div>}

      <h2>Endpoints ({data.endpoints.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead><tr>{['Method', 'Path', 'Summary', 'Actions'].map((h) => <th key={h} style={{ textAlign: 'left', borderBottom: '2px solid #ddd', padding: '0.5rem' }}>{h}</th>)}</tr></thead>
        <tbody>
          {data.endpoints.map((ep) => (
            <tr key={ep.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem', fontWeight: 700, color: ep.method === 'GET' ? '#090' : ep.method === 'POST' ? '#06c' : ep.method === 'DELETE' ? '#c00' : '#c60' }}>{ep.method}</td>
              <td style={{ padding: '0.5rem' }}><code>{ep.path}</code></td>
              <td style={{ padding: '0.5rem' }}>{ep.summary ?? <em style={{ color: '#aaa' }}>—</em>}</td>
              <td style={{ padding: '0.5rem' }}>
                <button style={{ fontSize: '0.8rem' }} onClick={() => setEditing({ endpointId: ep.id, field: 'summary', value: ep.summary ?? '' })}>Edit summary</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div style={{ background: '#fffbe6', border: '1px solid #fc0', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Edit {editing.field}</h3>
          <input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} style={{ width: '100%', marginBottom: '0.5rem' }} />
          <button onClick={saveEdit}>Save</button>
          <button onClick={() => setEditing(null)} style={{ marginLeft: '0.5rem' }}>Cancel</button>
        </div>
      )}

      <button onClick={publish} disabled={publishing || published} style={{ background: '#0a0', color: '#fff', padding: '0.75rem 1.5rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '1rem' }}>
        {publishing ? 'Publishing…' : 'Publish to Catalog'}
      </button>
    </main>
  );
}
