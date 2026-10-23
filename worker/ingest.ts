const LIMIT = 64 * 1024;

export async function ingest(request: Request): Promise<Response> {
  if (!['GET', 'POST', 'OPTIONS'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST, OPTIONS' } });
  }
  if (Number(request.headers.get('Content-Length')) > LIMIT) return new Response(null, { status: 413 });
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > LIMIT) { await reader.cancel(); return new Response(null, { status: 413 }); }
        chunks.push(value);
      }
    } catch { return new Response(null, { status: 502 }); }
    body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  }
  const url = new URL(request.url);
  const path = url.pathname.slice('/ingest'.length);
  // Concatenate onto a fixed origin: a // path must never become another host.
  const target = `https://${path.startsWith('/static/') ? 'eu-assets.i.posthog.com' : 'eu.i.posthog.com'}${path}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete('Cookie'); headers.delete('Authorization'); headers.delete('Host');
  // Same-origin fetch Referer can contain email/query data outside before_send.
  headers.delete('Referer');
  headers.delete('Content-Length'); headers.delete('X-Forwarded-For');
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For', ip);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetch(target, { method: request.method, headers, body, signal: controller.signal, redirect: 'error', cache: 'no-store' });
    // Read inside the timeout as well, so a stalled upstream body cannot hang.
    const responseBody = await upstream.arrayBuffer();
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    const contentType = upstream.headers.get('Content-Type');
    if (contentType) responseHeaders.set('Content-Type', contentType);
    return new Response([204, 205, 304].includes(upstream.status) ? null : responseBody, { status: upstream.status, headers: responseHeaders });
  } catch { return new Response(null, { status: 502 }); }
  finally { clearTimeout(timer); }
}
