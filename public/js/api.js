import { addToSyncQueue } from './store.js';

const API_BASE = '';

export async function api(method, path, body) {
  const url = API_BASE + path;
  const opts = { method, headers: {} };

  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    opts.body = body;
  }

  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return await res.json();
  } catch (err) {
    if (method !== 'GET' && !navigator.onLine) {
      await addToSyncQueue({ method, endpoint: path, payload: body instanceof FormData ? null : body });
      throw new Error('Queued for sync');
    }
    throw err;
  }
}

// Convenience methods
export const getAssets = (params) => api('GET', '/api/assets' + toQuery(params));
export const getAsset = (id) => api('GET', `/api/assets/${id}`);
export const createAsset = (data) => api('POST', '/api/assets', data);
export const updateAsset = (id, data) => api('PUT', `/api/assets/${id}`, data);
export const deleteAsset = (id) => api('DELETE', `/api/assets/${id}`);

export const getIssues = (params) => api('GET', '/api/issues' + toQuery(params));
export const getIssue = (id) => api('GET', `/api/issues/${id}`);
export const createIssue = (data) => api('POST', '/api/issues', data);
export const updateIssue = (id, data) => api('PUT', `/api/issues/${id}`, data);
export const resolveIssue = (id) => api('PUT', `/api/issues/${id}/resolve`);
export const deleteIssue = (id) => api('DELETE', `/api/issues/${id}`);

export const uploadPhoto = (formData) => api('POST', '/api/photos', formData);
export const deletePhoto = (id) => api('DELETE', `/api/photos/${id}`);

export const getActivity = (params) => api('GET', '/api/activity' + toQuery(params));
export const search = (q) => api('GET', `/api/search?q=${encodeURIComponent(q)}`);
export const migrateData = (issues) => api('POST', '/api/migrate', { issues });

export function photoUrl(id) {
  return `/api/photos/${id}/file`;
}

export function exportUrl(type, format = 'csv') {
  return `/api/export/${type}?format=${format}`;
}

function toQuery(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? '?' + new URLSearchParams(entries).toString() : '';
}
