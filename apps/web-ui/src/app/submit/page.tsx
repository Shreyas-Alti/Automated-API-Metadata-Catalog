'use client';
import { useState } from 'react';
import { api } from '../../lib/api';

export default function SubmitPage() {
  const [form, setForm] = useState({ repositoryUrl: '', commitSha: '', parserName: 'express', hostUrl: '' });
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.extractions.submit({ repositoryUrl: form.repositoryUrl, commitSha: form.commitSha || undefined, parserName: form.parserName, hostUrl: form.hostUrl || undefined });
      setResult(res);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <main>
      <h1>Submit Repository</h1>
      <form onSubmit={submit} style={{ maxWidth: 480, display: 'grid', gap: '1rem' }}>
        <label>
          Repository URL *
          <input required value={form.repositoryUrl} onChange={(e) => setForm({ ...form, repositoryUrl: e.target.value })}
            placeholder="https://github.com/owner/repo" style={{ display: 'block', width: '100%', marginTop: 4 }} />
        </label>
        <label>
          Host URL (optional — for cross-source probing)
          <input value={form.hostUrl} onChange={(e) => setForm({ ...form, hostUrl: e.target.value })}
            placeholder="https://api.example.com" style={{ display: 'block', width: '100%', marginTop: 4 }} />
        </label>
        <label>
          Commit SHA (optional, defaults to HEAD)
          <input value={form.commitSha} onChange={(e) => setForm({ ...form, commitSha: e.target.value })}
            placeholder="abc123" style={{ display: 'block', width: '100%', marginTop: 4 }} />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit'}</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {result && (
          <div style={{ background: '#f0fff0', border: '1px solid #0a0', padding: '1rem', borderRadius: 8 }}>
            <p><strong>Submitted!</strong> Run ID: <code>{result.id}</code></p>
            <a href={`/extractions/${result.id}`}>View status →</a>
          </div>
        )}
      </form>
    </main>
  );
}
