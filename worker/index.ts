import type { Env } from './env';
import { waitlist, unsubscribe } from './handler';
import { processOutbox } from './outbox';
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    const allowed = path === '/api/health' ? 'GET' : path === '/api/waitlist' ? 'POST' : path === '/api/unsubscribe' ? 'GET, POST' : null;
    if (!allowed) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    if (!allowed.split(', ').includes(request.method)) return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405, headers: { Allow: allowed } });
    if (path === '/api/unsubscribe') return unsubscribe(request, env);
    return path === '/api/health' ? Response.json({ ok: true }) : waitlist(request, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processOutbox(env).catch(() => console.error(JSON.stringify({ event: 'outbox_processing_failed' }))));
  },
};
