const fs = require('fs');

function patchFile(path, replacements) {
  let content = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!content.includes(from)) throw new Error(`Missing expected text in ${path}: ${from.slice(0, 80)}`);
    content = content.replace(from, to);
  }
  fs.writeFileSync(path, content);
}

patchFile('utils/bostaService.ts', [
  ["async function safeFetchJson(url: string, options?: RequestInit, fallbackError?: string): Promise<any> {\n  try {\n    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000';\n    const urlObj = new URL(url, origin);", "const CARRIER_API_BASE = (import.meta.env.VITE_CARRIER_API_BASE_URL || 'https://api.abdomedi.com').replace(/\\/$/, '');\n\nasync function safeFetchJson(url: string, options?: RequestInit, fallbackError?: string): Promise<any> {\n  try {\n    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000';\n    const requestBase = url.startsWith('/api/bosta/') ? CARRIER_API_BASE : origin;\n    const urlObj = new URL(url, requestBase);"],
  ["const res = await fetch(finalUrl, options);", "const res = await fetch(finalUrl, options);"],
  ["const res = await fetch(`/api/bosta/cities/${encodeURIComponent(cityId)}/districts`);", "const res = await fetch(`${CARRIER_API_BASE}/api/bosta/cities/${encodeURIComponent(cityId)}/districts`);"],
  ["const res = await fetch(`/api/bosta/cities/${encodeURIComponent(cityId)}/zones`);", "const res = await fetch(`${CARRIER_API_BASE}/api/bosta/cities/${encodeURIComponent(cityId)}/zones`);"],
  ["const res = await fetch(`/api/bosta/businesses/${encodeURIComponent(businessId)}${query}`);", "const res = await fetch(`${CARRIER_API_BASE}/api/bosta/businesses/${encodeURIComponent(businessId)}${query}`);"],
  ["const res = await fetch(`/api/bosta/businesses/${encodeURIComponent(businessId)}/pickup-locations`, {", "const res = await fetch(`${CARRIER_API_BASE}/api/bosta/businesses/${encodeURIComponent(businessId)}/pickup-locations`, {"],
  ["const res = await fetch(`/api/bosta/pricing/calculator?${q.toString()}`);", "const res = await fetch(`${CARRIER_API_BASE}/api/bosta/pricing/calculator?${q.toString()}`);"],
  ["const res = await fetch(`/api/bosta/deliveries/${encodeURIComponent(id)}?${q.toString()}`);", "const res = await fetch(`${CARRIER_API_BASE}/api/bosta/deliveries/${encodeURIComponent(id)}?${q.toString()}`);"],
  ["const res = await fetch(query);", "const res = await fetch(`${CARRIER_API_BASE}${query}`);"],
]);

patchFile('utils/turboService.ts', [
  ["async function safeFetchJson(url: string, options?: RequestInit, fallbackError?: string): Promise<any> {\n  try {\n    const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000');", "const CARRIER_API_BASE = (import.meta.env.VITE_CARRIER_API_BASE_URL || 'https://api.abdomedi.com').replace(/\\/$/, '');\n\nasync function safeFetchJson(url: string, options?: RequestInit, fallbackError?: string): Promise<any> {\n  try {\n    const requestBase = url.startsWith('/api/turbo/') || url.startsWith('/api/shipping/turbo/') ? CARRIER_API_BASE : (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000');\n    const urlObj = new URL(url, requestBase);"],
]);

patchFile('cloudflare-worker/src/index.ts', [
  ["  const body = await request.json().catch(() => ({})) as { apiKey?: string; environment?: string };\n  const key = cleanSecret(body.apiKey || env.BOSTA_API_KEY);", "  const body = await request.json().catch(() => ({})) as { apiKey?: string; environment?: string };\n  const query = new URL(request.url).searchParams;\n  const key = cleanSecret(body.apiKey || query.get('apiKey') || request.headers.get('x-api-key') || env.BOSTA_API_KEY);"],
  ["  const body = await request.json().catch(() => ({})) as { apiKey?: string };\n  const key = cleanSecret(body.apiKey || env.TURBO_API_KEY);", "  const body = await request.json().catch(() => ({})) as { apiKey?: string };\n  const query = new URL(request.url).searchParams;\n  const key = cleanSecret(body.apiKey || query.get('apiKey') || request.headers.get('x-api-key') || env.TURBO_API_KEY);"],
  ["      const upstream = await fetch(`${bostaBase(env, false)}/api/v2/cities`, { headers: { Accept: \"application/json\" } });\n      const parsed = await parseUpstream(upstream);\n      return response(request, env, parsed.data || { success: false, error: parsed.text.slice(0, 300) }, upstream.ok ? 200 : upstream.status);", "      const query = new URL(request.url).searchParams;\n      const base = bostaBase(env, query.get('staging') === 'true');\n      const key = cleanSecret(query.get('apiKey') || request.headers.get('x-api-key') || env.BOSTA_API_KEY);\n      const headers: Record<string, string> = { Accept: 'application/json' };\n      if (key) { headers.Authorization = key; headers['x-api-key'] = key; }\n      const upstream = await fetch(`${base}/api/v2/cities`, { headers });\n      const parsed = await parseUpstream(upstream);\n      const raw = parsed.data;\n      const list = raw?.data || raw?.list || (Array.isArray(raw) ? raw : []);\n      return response(request, env, { success: upstream.ok, list, data: raw, error: upstream.ok ? undefined : (raw?.message || parsed.text.slice(0, 300)) }, upstream.ok ? 200 : upstream.status);"],
]);

console.log('Carrier routing patches applied.');
