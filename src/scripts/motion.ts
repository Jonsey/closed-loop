/**
 * Closed Loop motion layer.
 *  - scroll reveal via IntersectionObserver ([data-reveal])
 *  - scroll-linked parallax via CSS custom properties (.parallax, .backdrop)
 *  - reading progress bar on articles (.progress)
 * Re-initialises on every ClientRouter navigation (astro:page-load).
 */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let observer: IntersectionObserver | null = null;
let rafPending = false;

function initReveal() {
  observer?.disconnect();
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduced()) { els.forEach((el) => el.classList.add('in')); return; }
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add('in');
          observer!.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
  );
  els.forEach((el) => observer!.observe(el));
}

function onScroll() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const y = window.scrollY;
    document.documentElement.style.setProperty('--scroll-y', String(y));

    if (!reduced()) {
      document.querySelectorAll<HTMLElement>('.parallax').forEach((el) => {
        const speed = parseFloat(el.dataset.speed ?? '0.2');
        const rect = el.getBoundingClientRect();
        // offset relative to element's own position in the viewport, so it's centred when in view
        const centre = rect.top + rect.height / 2 - window.innerHeight / 2;
        el.style.transform = `translate3d(0, ${(-centre * speed).toFixed(1)}px, 0)`;
      });
    }

    const bar = document.querySelector<HTMLElement>('.progress');
    if (bar) {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      bar.style.setProperty('--progress', max > 0 ? String(Math.min(1, y / max)) : '0');
    }
  });
}

function init() {
  initReveal();
  onScroll();
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
document.addEventListener('astro:page-load', init);
