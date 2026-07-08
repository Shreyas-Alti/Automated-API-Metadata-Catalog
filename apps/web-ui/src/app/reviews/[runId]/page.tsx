'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { Endpoint, EvidenceRecord } from '../../../lib/api';

interface ReviewData {
  run: { id: string; repositoryUrl: string; status: string };
  endpoints: Endpoint[];
  evidence: EvidenceRecord[];
}

export default function ReviewDetailPage({ params }: { params: { runId: string } }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [editing, setEditing] = useState<{ endpointId: string; field: string; value: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const load = () => api.reviews.get(params.runId).then((d) => setData(d as ReviewData)).catch(() => {});
  useEffect(() => { load(); }, [params.runId]);

  const saveEdit = async () => {
    if (!editing) return;
    await api.reviews.editEndpoint(params.runId, editing.endpointId, editing.field, editing.value);
    setEditing(null);
    load();
  };

  const acceptSuggestion = async (endpointId: string, field: string, value: string) => {
    await api.reviews.editEndpoint(params.runId, endpointId, field, value);
    load();
  };

  const publish = async () => {
    setPublishing(true);
    await api.reviews.publish(params.runId);
    setPublished(true);
    setPublishing(false);
  };

  if (!data) return <p>Loading…</p>;

  // Index AI suggestions by endpoint+field for quick lookup
  const aiSuggestions = new Map<string, string>();
  for (const ev of data.evidence) {
    if (ev.source === 'llm-enrichment' && ev.verificationStatus === 'ai-suggested') {
      aiSuggestions.set(`${ev.endpointId}:${ev.field}`, ev.value as string);
    }
  }

  return (
    <main>
      <h1>Review: {data.run.repositoryUrl}</h1>
      {published && <div style={{ background: '#f0fff0', border: '1px solid #0a0', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>✅ Published! <a href="/catalog">View in catalog →</a></div>}

      <h2>Endpoints ({data.endpoints.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
        <thead><tr>{['Method', 'Path', 'Summary', 'Actions'].map((h) => <th key={h} style={{ textAlign: 'left', borderBottom: '2px solid #ddd', padding: '0.5rem' }}>{h}</th>)}</tr></thead>
        <tbody>
          {data.endpoints.map((ep) => {
            const suggestedSummary = aiSuggestions.get(`${ep.id}:summary`);
            const suggestedDesc = aiSuggestions.get(`${ep.id}:description`);
            return (
              <tr key={ep.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontWeight: 700, color: ep.method === 'GET' ? '#090' : ep.method === 'POST' ? '#06c' : ep.method === 'DELETE' ? '#c00' : '#c60' }}>{ep.method}</td>
                <td style={{ padding: '0.5rem' }}><code>{ep.path}</code></td>
                <td style={{ padding: '0.5rem' }}>
                  {ep.summary
                    ? ep.summary
                    : suggestedSummary
                      ? (
                        <span>
                          <em style={{ color: '#7c4dff' }}>AI suggests:</em>{' '}
                          <span style={{ color: '#555' }}>{suggestedSummary}</span>{' '}
                          <button
                            style={{ fontSize: '0.7rem', marginLeft: '0.5rem', background: '#7c4dff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 6px' }}
                            onClick={() => acceptSuggestion(ep.id, 'summary', suggestedSummary)}
                          >Accept</button>
                        </span>
                      )
                      : <em style={{ color: '#aaa' }}>—</em>
                  }
                  {!ep.description && suggestedDesc && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
                      <em style={{ color: '#7c4dff' }}>AI desc:</em>{' '}
                      <span style={{ color: '#666' }}>{suggestedDesc}</span>{' '}
                      <button
                        style={{ fontSize: '0.65rem', background: '#7c4dff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 5px' }}
                        onClick={() => acceptSuggestion(ep.id, 'description', suggestedDesc)}
                      >Accept</button>
                    </div>
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <button style={{ fontSize: '0.8rem' }} onClick={() => setEditing({ endpointId: ep.id, field: 'summary', value: ep.summary ?? suggestedSummary ?? '' })}>Edit</button>
                </td>
              </tr>
            );
          })}
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
