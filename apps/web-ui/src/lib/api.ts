const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface SubmitExtractionDto { repositoryUrl: string; commitSha?: string; parserName?: string; hostUrl?: string; }
export interface ExtractionRun { id: string; repositoryUrl: string; status: string; commitSha: string; createdAt: string; }
export interface ReviewSummary { id: string; repositoryUrl: string; status: string; createdAt: string; }
export interface Endpoint { id: string; method: string; path: string; summary?: string; description?: string; }
export interface CatalogEntry { apiId: string; name: string; repositoryUrl: string; publishedAt: string; }

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ accessToken: string }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (data: { email: string; password: string; name: string; organisationName: string }) =>
      apiFetch<{ accessToken: string }>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  },
  extractions: {
    submit: (dto: SubmitExtractionDto) =>
      apiFetch<{ id: string; status: string }>('/api/v1/extractions', { method: 'POST', body: JSON.stringify(dto) }),
    get: (id: string) => apiFetch<ExtractionRun>(`/api/v1/extractions/${id}`),
    list: () => apiFetch<ExtractionRun[]>('/api/v1/extractions'),
  },
  reviews: {
    list: () => apiFetch<ReviewSummary[]>('/api/v1/reviews'),
    get: (runId: string) => apiFetch<{ run: ExtractionRun; endpoints: Endpoint[] }>(`/api/v1/reviews/${runId}`),
    editEndpoint: (runId: string, endpointId: string, field: string, value: string) =>
      apiFetch(`/api/v1/reviews/${runId}/endpoints/${endpointId}`, { method: 'PATCH', body: JSON.stringify({ field, value }) }),
    publish: (runId: string) =>
      apiFetch(`/api/v1/reviews/${runId}/publish`, { method: 'POST' }),
  },
  catalog: {
    list: () => apiFetch<CatalogEntry[]>('/api/v1/catalog'),
    get: (apiId: string) => apiFetch<{ api: { name: string; hostUrl?: string }; endpoints: Endpoint[]; openApiDoc: unknown }>(`/api/v1/catalog/${apiId}`),
  },
};
