/**
 * Closed Loop edge worker.
 * The site is static assets; this handles the two POST endpoints the forms use and
 * hands everything else to the asset binding.
 *
 *   POST /api/contact    { name, email, message, cost?, turnstile, website? }
 *   POST /api/subscribe  { email, turnstile, website? }
 *
 * Secrets (wrangler secret put …): RESEND_API_KEY, TURNSTILE_SECRET, CONTACT_TO
 * Vars (wrangler.jsonc):            CONTACT_FROM, TURNSTILE_HOSTNAMES, RESEND_SEGMENT_ID (optional)
 * Local dev: put them in .dev.vars (gitignored). DRY_RUN=1 skips Resend and logs instead.
 */
export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
  RESEND_SEGMENT_ID?: string; // optional: a Resend Segment the subscriber is added to (Audiences are deprecated)
  TURNSTILE_HOSTNAMES?: string; // comma-separated; defaults to closed-loop.dev
  DRY_RUN?: string;
}

const MAX = { name: 120, email: 200, message: 5000, cost: 200 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Cloudflare's existing-widget contract: success AND the action AND the hostname must match. Tokens are single-use. */
async function verifyTurnstile(env: Env, token: string, ip: string | null, expectedAction: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return env.DRY_RUN === '1';
  if (!token) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) body.set('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = (await r.json()) as { success?: boolean; action?: string; hostname?: string; 'error-codes'?: string[] };
  if (!data.success) { console.warn('turnstile failed', data['error-codes']); return false; }
  if (env.DRY_RUN === '1') return true; // wrangler dev + Cloudflare's test keys: no action/hostname in the response
  if (data.action !== expectedAction) { console.warn('turnstile action mismatch', data.action); return false; }
  const allowed = new Set((env.TURNSTILE_HOSTNAMES ?? 'closed-loop.dev,www.closed-loop.dev').split(',').map((h) => h.trim()).filter(Boolean));
  if (!data.hostname || !allowed.has(data.hostname)) { console.warn('turnstile hostname mismatch', data.hostname); return false; }
  return true;
}

async function resend(env: Env, path: string, payload: unknown): Promise<Response> {
  if (env.DRY_RUN === '1' || !env.RESEND_API_KEY) {
    console.log('[dry-run] resend', path, JSON.stringify(payload));
    return new Response('{}', { status: 200 });
  }
  return fetch(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const ct = request.headers.get('content-type') ?? '';
  try {
    if (ct.includes('application/json')) return (await request.json()) as Record<string, unknown>;
    const fd = await request.formData();
    return Object.fromEntries(fd.entries());
  } catch {
    return null;
  }
}

async function contact(request: Request, env: Env): Promise<Response> {
  const b = await readBody(request);
  if (!b) return json({ ok: false, error: 'Could not read the form.' }, 400);
  if (clean(b.website, 50)) return json({ ok: true }); // honeypot filled: pretend success, send nothing

  const name = clean(b.name, MAX.name);
  const email = clean(b.email, MAX.email);
  const message = clean(b.message, MAX.message);
  const cost = clean(b.cost, MAX.cost);
  const token = clean(b['cf-turnstile-response'] ?? b.turnstile, 5000);

  if (!name || !EMAIL.test(email) || message.length < 10) return json({ ok: false, error: 'Name, a valid email and a message of at least ten characters, please.' }, 400);
  if (!(await verifyTurnstile(env, token, request.headers.get('cf-connecting-ip'), 'contact'))) return json({ ok: false, error: 'The anti-spam check did not pass. Try again, or email us directly.' }, 400);

  const to = env.CONTACT_TO;
  const from = env.CONTACT_FROM ?? 'Closed Loop <hello@closed-loop.dev>';
  if (!to && env.DRY_RUN !== '1') return json({ ok: false, error: 'Contact is not configured yet — email us directly.' }, 500);

  const subject = `Enquiry from ${name}${cost ? ` — ${cost}` : ''}`;
  const text = [`From: ${name} <${email}>`, cost ? `What it costs them: ${cost}` : '', '', message].filter((l) => l !== '').join('\n');
  const html = `<p><strong>From:</strong> ${esc(name)} &lt;${esc(email)}&gt;</p>${cost ? `<p><strong>What it costs them:</strong> ${esc(cost)}</p>` : ''}<p style="white-space:pre-wrap">${esc(message)}</p>`;

  const r = await resend(env, '/emails', { from, to: [to ?? 'dry-run@example.invalid'], reply_to: email, subject, text, html });
  if (!r.ok) {
    console.error('resend failed', r.status, await r.text());
    return json({ ok: false, error: 'Sending failed at our end. Email us directly and we will still reply.' }, 502);
  }
  return json({ ok: true });
}

async function subscribe(request: Request, env: Env): Promise<Response> {
  const b = await readBody(request);
  if (!b) return json({ ok: false, error: 'Could not read the form.' }, 400);
  if (clean(b.website, 50)) return json({ ok: true });

  const email = clean(b.email, MAX.email);
  const token = clean(b['cf-turnstile-response'] ?? b.turnstile, 5000);
  if (!EMAIL.test(email)) return json({ ok: false, error: 'That does not look like an email address.' }, 400);
  if (!(await verifyTurnstile(env, token, request.headers.get('cf-connecting-ip'), 'subscribe'))) return json({ ok: false, error: 'The anti-spam check did not pass.' }, 400);
  // Resend contacts are global; a segment is optional grouping for broadcasts.
  const payload: Record<string, unknown> = { email, unsubscribed: false };
  if (env.RESEND_SEGMENT_ID) payload.segments = [env.RESEND_SEGMENT_ID];
  const r = await resend(env, '/contacts', payload);
  if (!r.ok && r.status !== 409) {
    console.error('resend contact failed', r.status, await r.text());
    return json({ ok: false, error: 'Signup failed at our end. Try again later.' }, 502);
  }
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'POST') return json({ ok: false, error: 'POST only.' }, 405);
      // Same-origin only: the forms live on this site.
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) return json({ ok: false, error: 'Bad origin.' }, 403);
      if (url.pathname === '/api/contact') return contact(request, env);
      if (url.pathname === '/api/subscribe') return subscribe(request, env);
      return json({ ok: false, error: 'Not found.' }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
