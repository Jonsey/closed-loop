/**
 * "What is it costing you?" — the value calculator on /how-we-work/.
 * Everything runs in the browser. Nothing is stored, nothing is sent anywhere.
 * Re-initialises on every ClientRouter navigation (astro:page-load), like motion.ts.
 *
 * Supply mode:  hours/week × people × £/hour × 48 weeks          = annual cost of the manual process
 * Demand mode:  missed enquiries/week × conversion % × £/deal × 48 = annual revenue leaking out
 * Then:         value in year one = annual × recovery %
 *               fixed fee band   = 10%–20% of that value
 */
const WEEKS = 48;
const FEE_LO = 0.1;
const FEE_HI = 0.2;
const FLOOR = 2000; // below this a build is usually not worth it — see the Honestly section

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

function val(root: HTMLElement, name: string): number {
  const el = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
  const n = el ? parseFloat(el.value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function set(root: HTMLElement, key: string, text: string) {
  root.querySelectorAll<HTMLElement>(`[data-out="${key}"]`).forEach((el) => (el.textContent = text));
}

function compute(root: HTMLElement) {
  const mode = root.dataset.mode ?? 'supply';
  let annual = 0;
  let working = '';

  if (mode === 'supply') {
    const hours = val(root, 'hours');
    const people = val(root, 'people');
    const rate = val(root, 'rate');
    annual = hours * people * rate * WEEKS;
    working = `${num.format(hours)} h/wk × ${num.format(people)} ${people === 1 ? 'person' : 'people'} × ${gbp.format(rate)}/h × ${WEEKS} wks = ${gbp.format(annual)}`;
  } else {
    const missed = val(root, 'missed');
    const conv = val(root, 'conversion') / 100;
    const deal = val(root, 'deal');
    annual = missed * conv * deal * WEEKS;
    working = `${num.format(missed)}/wk × ${num.format(conv * 100)}% × ${gbp.format(deal)} × ${WEEKS} wks = ${gbp.format(annual)}`;
  }

  const recovery = val(root, 'recovery') / 100;
  const value = annual * recovery;
  const lo = value * FEE_LO;
  const hi = value * FEE_HI;

  set(root, 'annual', gbp.format(annual));
  set(root, 'working', working);
  set(root, 'recovery', `${num.format(recovery * 100)}%`);
  set(root, 'value', gbp.format(value));
  set(root, 'value-working', `${gbp.format(annual)} × ${num.format(recovery * 100)}% = ${gbp.format(value)}`);
  set(root, 'fee', `${gbp.format(lo)} – ${gbp.format(hi)}`);
  set(root, 'fee-working', `${gbp.format(value)} × 10% … 20%`);
  set(root, 'multiple', value > 0 && hi > 0 ? `${num.format(value / hi)}× – ${num.format(value / lo)}×` : '—');

  set(root, 'floor', annual > 0 && hi < FLOOR ? `Under the ~${gbp.format(FLOOR)} floor — at this value a build usually isn't worth it, and we'd say so. See “Where this method says no”.` : '');

  root.classList.toggle('empty', annual === 0);
}

function init() {
  const root = document.querySelector<HTMLElement>('[data-calculator]');
  if (!root) return;

  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.tab!;
      root.dataset.mode = mode;
      root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
        const on = b.dataset.tab === mode;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      root.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => {
        p.hidden = p.dataset.panel !== mode;
      });
      compute(root);
    });
  });

  root.querySelectorAll<HTMLInputElement>('input').forEach((i) => i.addEventListener('input', () => compute(root)));
  compute(root);
}

document.addEventListener('astro:page-load', init);
