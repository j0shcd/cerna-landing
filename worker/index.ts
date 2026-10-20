import type { Env } from './env';
import { waitlist } from './handler';
import { processOutbox } from './outbox';
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    const allowed = path === '/api/health' ? 'GET' : path === '/api/waitlist' ? 'POST' : null;
    if (!allowed) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    if (request.method !== allowed) return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405, headers: { Allow: allowed } });
    return path === '/api/health' ? Response.json({ ok: true }) : waitlist(request, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processOutbox(env).catch(() => console.error(JSON.stringify({ event: 'outbox_processing_failed' }))));
  },
};
