/**
 * Progressive enhancement for the contact and subscribe forms ([data-form]).
 * Without JS the forms POST normally and the worker answers with JSON — ugly but functional.
 * With JS: fetch, inline status, Turnstile reset, and the fields stay put on failure.
 * Re-initialises on every ClientRouter navigation (astro:page-load).
 */
declare global {
  interface Window { turnstile?: { reset: (el?: Element | string) => void; render: (el: Element | string, opts: Record<string, unknown>) => string } }
}

function status(form: HTMLFormElement, kind: 'idle' | 'busy' | 'ok' | 'error', text = '') {
  const el = form.querySelector<HTMLElement>('[data-status]');
  if (!el) return;
  el.dataset.kind = kind;
  el.textContent = text;
  form.classList.toggle('sent', kind === 'ok');
}

function init() {
  document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const fd = new FormData(form);
      const token = fd.get('cf-turnstile-response');
      if (!token) { status(form, 'error', 'Give the anti-spam check a second to finish, then try again.'); return; }
      if (btn) btn.disabled = true;
      status(form, 'busy', 'Sending…');
      try {
        const r = await fetch(form.action, { method: 'POST', body: fd, headers: { accept: 'application/json' } });
        const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (r.ok && data.ok) {
          status(form, 'ok', form.dataset.success ?? 'Sent.');
          form.reset();
        } else {
          status(form, 'error', data.error ?? 'Something went wrong. Email us directly and we will still reply.');
        }
      } catch {
        status(form, 'error', 'Network error. Email us directly and we will still reply.');
      } finally {
        if (btn) btn.disabled = false;
        const widget = form.querySelector('.cf-turnstile');
        if (widget && window.turnstile) window.turnstile.reset(widget);
      }
    });
  });
}

document.addEventListener('astro:page-load', init);
