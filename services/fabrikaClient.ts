import type { FabrikaJob, FabrikaJobSettings, FabrikaPromptDefaults, FabrikaRow } from '../types';

// Note: SSE is exposed by the server at /api/fabrika/jobs/:id/stream, but EventSource
// can't set custom headers (needed for X-API-Key auth). For the hackathon we poll.
// Switch to SSE later if session-cookie auth is added.

function apiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('api_secret') || (import.meta.env.VITE_API_SECRET ?? '');
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  return { 'X-API-Key': apiKey(), ...extra };
}

export async function createJob(
  xlsx: File,
  zip: File,
  settings: FabrikaJobSettings,
  selectedKeys?: string[],
): Promise<{ jobId: string; totalPdfs: number; unmatchedColumns: FabrikaJob['unmatchedColumns'] }> {
  const form = new FormData();
  form.append('xlsx', xlsx);
  form.append('zip', zip);
  form.append('settings', JSON.stringify(settings));
  if (selectedKeys && selectedKeys.length > 0) {
    form.append('selectedKeys', JSON.stringify(selectedKeys));
  }
  const res = await fetch('/api/fabrika/jobs', { method: 'POST', headers: headers(), body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function pollJob(jobId: string): Promise<FabrikaJob> {
  const res = await fetch(`/api/fabrika/jobs/${jobId}`, { headers: headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getRowDetail(jobId: string, rowId: string): Promise<FabrikaRow> {
  const res = await fetch(`/api/fabrika/jobs/${jobId}/rows/${rowId}`, { headers: headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function retryRow(jobId: string, rowId: string): Promise<void> {
  const res = await fetch(`/api/fabrika/jobs/${jobId}/rows/${rowId}/retry`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

export async function getPromptDefaults(): Promise<FabrikaPromptDefaults> {
  const res = await fetch('/api/fabrika/prompts', { headers: headers() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
