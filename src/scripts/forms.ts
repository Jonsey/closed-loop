/**
 * Progressive enhancement for the contact and subscribe forms ([data-form]).
 * Without JS the forms POST normally and the worker answers with JSON — ugly but functional.
 * With JS: fetch, inline status, Turnstile reset, and the fields stay put on failure.
 * Re-initialises on every ClientRouter navigation (astro:page-load).
 */
declare global {
  interface Window {
    turnstile?: {
      reset: (el?: Element | string) => void;
      remove: (el?: Element | string) => void;
      render: (el: Element | string, opts: Record<string, unknown>) => string | undefined;
    };
    onTurnstileReady?: () => void;
  }
}

/**
 * Render every .cf-turnstile that hasn't been rendered yet. The api.js implicit mode only
 * scans the DOM once on script load, so widgets that arrive via a ClientRouter navigation
 * would never render and the form would submit with no token. Explicit mode + this fixes it.
 */
function renderWidgets() {
  const ts = window.turnstile;
  if (!ts) return;
  document.querySelectorAll<HTMLElement>('.cf-turnstile').forEach((el) => {
    if (el.dataset.rendered) return;
    const id = ts.render(el, {
      sitekey: el.dataset.sitekey,
      action: el.dataset.action,
      theme: el.dataset.theme ?? 'dark',
      size: el.dataset.size ?? 'flexible',
      appearance: el.dataset.appearance ?? 'always',
      'error-callback': () => { el.dataset.error = '1'; },
    });
    if (id) el.dataset.rendered = id;
  });
}
window.onTurnstileReady = renderWidgets;

function status(form: HTMLFormElement, kind: 'idle' | 'busy' | 'ok' | 'error', text = '') {
  const el = form.querySelector<HTMLElement>('[data-status]');
  if (!el) return;
  el.dataset.kind = kind;
  el.textContent = text;
  form.classList.toggle('sent', kind === 'ok');
}

function init() {
  renderWidgets();
  document.querySelectorAll<HTMLFormElement>('form[data-form]').forEach((form) => {
    if (form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const fd = new FormData(form);
      const widget = form.querySelector<HTMLElement>('.cf-turnstile');
      const token = fd.get('cf-turnstile-response');
      if (!token) {
        if (widget && !widget.dataset.rendered) renderWidgets();
        const n = Number(form.dataset.retries ?? 0) + 1;
        form.dataset.retries = String(n);
        status(form, 'error', n > 1
          ? 'The anti-spam check is not completing in this browser. Email us directly — the address is on the left.'
          : 'The anti-spam check has not finished — give it a second, tick the box if one appears, then send again.');
        return;
      }
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
        if (widget && window.turnstile && widget.dataset.rendered) window.turnstile.reset(widget);
      }
    });
  });
}

document.addEventListener('astro:page-load', init);
