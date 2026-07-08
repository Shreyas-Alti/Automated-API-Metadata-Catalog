'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { ReviewSummary } from '../../lib/api';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);

  useEffect(() => { api.reviews.list().then(setReviews).catch(() => {}); }, []);

  return (
    <main>
      <h1>Pending Reviews</h1>
      {reviews.length === 0 ? <p>No reviews pending.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Repository', 'Status', 'Submitted', 'Action'].map((h) => <th key={h} style={{ textAlign: 'left', borderBottom: '2px solid #ddd', padding: '0.5rem' }}>{h}</th>)}</tr></thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{r.repositoryUrl}</td>
                <td style={{ padding: '0.5rem' }}>{r.status}</td>
                <td style={{ padding: '0.5rem' }}>{new Date(r.createdAt).toLocaleString()}</td>
                <td style={{ padding: '0.5rem' }}><a href={`/reviews/${r.id}`}>Review →</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
