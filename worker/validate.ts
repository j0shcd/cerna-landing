export const CONSENT_TEXT = 'Get notified when we launch.';
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.normalize('NFKC').trim().toLowerCase();
  if (!/^[\x00-\x7f]*$/.test(email) || new TextEncoder().encode(email).byteLength > 254) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts as [string, string];
  if (local.length < 1 || local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return null;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  const labels = domain.split('.');
  if (labels.length < 2) return null;
  if (labels.some(label => label.length < 1 || label.length > 63 ||
    !/^[a-z0-9-]+$/.test(label) || label.startsWith('-') || label.endsWith('-'))) return null;
  const finalLabel = labels[labels.length - 1]!;
  if (!/^[a-z]{2,}$/.test(finalLabel) && !/^xn--[a-z0-9-]+$/.test(finalLabel)) return null;
  return email;
}
export function allowedOrigin(request: Request, siteOrigin: string): boolean {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  if (origin === null && referer === null) return true;
  try {
    const candidate = origin ?? new URL(referer!).origin;
    if (candidate === siteOrigin) return true;
    const url = new URL(candidate!);
    return !siteOrigin.startsWith('https:') && url.origin === candidate &&
      url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch { return false; }
}
export async function readBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new Error('body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
