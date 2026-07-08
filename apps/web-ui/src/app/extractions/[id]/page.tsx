'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { ExtractionRun } from '../../../lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#888', running: '#06c', review_required: '#c60',
  published: '#0a0', parser_error: '#c00', validation_failed: '#c00', quality_gate_failed: '#c00',
};

export default function ExtractionDetailPage({ params }: { params: { id: string } }) {
  const [run, setRun] = useState<ExtractionRun | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => api.extractions.get(params.id).then(setRun).catch((e: Error) => setError(e.message));
    load();
    // Poll while active
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [params.id]);

  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!run) return <p>Loading…</p>;

  const color = STATUS_COLORS[run.status] ?? '#888';
  return (
    <main>
      <h1>Extraction Run</h1>
      <p><strong>Repo:</strong> {run.repositoryUrl}</p>
      <p><strong>Status:</strong> <span style={{ color, fontWeight: 700 }}>{run.status}</span></p>
      <p><strong>Commit:</strong> <code>{run.commitSha}</code></p>
      <p><strong>Created:</strong> {new Date(run.createdAt).toLocaleString()}</p>
      {run.status === 'review_required' && (
        <a href={`/reviews/${run.id}`} style={{ display: 'inline-block', marginTop: '1rem', background: '#c60', color: '#fff', padding: '0.5rem 1rem', borderRadius: 6, textDecoration: 'none' }}>
          Review this extraction →
        </a>
      )}
    </main>
  );
}
