// Tiny state machine that drives every animated demo on the site.
//
// Markup contract
//   <div data-stepper data-durations="2200,2400,2600" data-rest="2">
//     <button data-go="0">…</button>          caption / tab that jumps to a step
//     <div data-from="1" data-to="2">…</div>   gets class "on" while 1 <= step <= 2
//   </div>
//
// The root also receives data-step="n" and the CSS var --step-dur, so all
// motion is plain CSS keyed off state. Demos only run while on screen, pause
// when the visitor picks a step, and honour prefers-reduced-motion (they
// rest on a representative frame and wait for the visitor to step through).

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setup(root: HTMLElement) {
  if (root.dataset.stepperReady) return;
  root.dataset.stepperReady = '1';

  const durations = (root.dataset.durations || '2400')
    .split(',')
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  const total = durations.length;
  const rest = Math.min(total - 1, parseInt(root.dataset.rest || String(total - 1), 10));
  const loop = root.dataset.loop !== 'false';

  const scoped = <T extends Element>(sel: string) =>
    Array.from(root.querySelectorAll<T>(sel)).filter((el) => el.closest('[data-stepper]') === root);

  const timed = scoped<HTMLElement>('[data-from]');
  const gos = scoped<HTMLElement>('[data-go]');
  const toggle = scoped<HTMLButtonElement>('[data-toggle]')[0];

  let step = -1;
  let timer: number | undefined;
  let visible = false;
  let held = false; // visitor chose a step or paused
  let hover = false;

  const render = (i: number) => {
    step = i;
    root.dataset.step = String(i);
    root.style.setProperty('--step-dur', `${durations[i]}ms`);
    timed.forEach((el) => {
      const from = parseInt(el.dataset.from || '0', 10);
      const to = el.dataset.to !== undefined ? parseInt(el.dataset.to, 10) : Infinity;
      el.classList.toggle('on', i >= from && i <= to);
    });
    gos.forEach((el) => {
      const active = parseInt(el.dataset.go || '0', 10) === i;
      el.classList.toggle('is-active', active);
      if (el.getAttribute('role') === 'tab') {
        el.setAttribute('aria-selected', String(active));
        el.tabIndex = active ? 0 : -1;
      } else {
        el.setAttribute('aria-current', active ? 'step' : 'false');
      }
    });
    root.dispatchEvent(new CustomEvent('stepchange', { detail: { step: i } }));
  };

  const playing = () => visible && !held && !hover && !reduced();

  const schedule = () => {
    window.clearTimeout(timer);
    root.classList.toggle('is-playing', playing());
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(held));
      toggle.setAttribute('aria-label', held ? 'Play animation' : 'Pause animation');
    }
    if (!playing()) return;
    timer = window.setTimeout(() => {
      const next = step + 1;
      if (next >= total && !loop) return;
      render(next % total);
      schedule();
    }, durations[step]);
  };

  gos.forEach((el) => {
    el.addEventListener('click', () => {
      held = true;
      render(parseInt(el.dataset.go || '0', 10));
      schedule();
    });
    el.addEventListener('keydown', (e: KeyboardEvent) => {
      if (el.getAttribute('role') !== 'tab') return;
      const idx = gos.indexOf(el);
      let to = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (idx + 1) % gos.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (idx - 1 + gos.length) % gos.length;
      if (e.key === 'Home') to = 0;
      if (e.key === 'End') to = gos.length - 1;
      if (to < 0) return;
      e.preventDefault();
      gos[to].focus();
      gos[to].click();
    });
  });

  toggle?.addEventListener('click', () => {
    held = !held;
    schedule();
  });

  if (root.dataset.hoverPause === 'true') {
    root.addEventListener('pointerenter', (e) => {
      if ((e as PointerEvent).pointerType !== 'mouse') return;
      hover = true;
      schedule();
    });
    root.addEventListener('pointerleave', () => {
      hover = false;
      schedule();
    });
  }

  render(reduced() ? rest : 0);

  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const was = visible;
        visible = entry.isIntersecting;
        if (visible && !was && !held && !reduced()) render(0);
        schedule();
      });
    },
    { threshold: 0.25 },
  ).observe(root);
}

export function initSteppers(scope: ParentNode = document) {
  scope.querySelectorAll<HTMLElement>('[data-stepper]').forEach(setup);
}
