import { BUILDABLES } from '../data/cabanas';
import { bus, Evt, SelectInfo } from '../events';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const coinHtml = '<i class="coin"></i>';

function boing(el: HTMLElement, cls = 'boing') {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Barra de construção, contador de moedas, botão verde de upgrade e dica. */
export function setupHud() {
  const bar = $('bar'), coins = $('coinN'), hint = $('hint'), up = $('upgrade');
  let coinsNow = 0;
  let sel: SelectInfo | null = null;
  const slots = new Map<string, { el: HTMLButtonElement; cost: number }>();

  for (const def of BUILDABLES) {
    const el = document.createElement('button');
    el.className = 'slot';
    el.title = def.nome;
    el.innerHTML = `<img src="assets/${def.levels[0].art}.png" alt=""><span class="cost">${coinHtml}${def.levels[0].cost}</span>`;
    el.addEventListener('click', () => { boing(el); bus.emit(Evt.Build, def.id); });
    bar.appendChild(el);
    slots.set(def.id, { el, cost: def.levels[0].cost });
  }

  function refresh() {
    for (const s of slots.values()) s.el.classList.toggle('poor', coinsNow < s.cost);
    if (sel?.next) up.classList.toggle('poor', !sel.next.lock && coinsNow < sel.next.cost);
  }

  bus.on(Evt.Coins, (n: number) => {
    if (n !== coinsNow) boing(coins.parentElement as HTMLElement, 'bump');
    coinsNow = n;
    coins.textContent = String(n);
    refresh();
  });

  bus.on(Evt.Placing, (id: string | null) => {
    for (const [k, s] of slots) s.el.classList.toggle('active', k === id);
  });

  bus.on(Evt.Hint, (text: string | null) => {
    hint.style.opacity = text ? '1' : '0';
    if (text) hint.textContent = text;
  });

  bus.on(Evt.Broke, (id: string) => {
    const el = id === 'upgrade' ? up : slots.get(id)?.el;
    if (el) boing(el, 'shake');
    boing($('coins'), 'shake');
  });

  bus.on(Evt.Select, (info: SelectInfo | null) => {
    sel = info;
    if (!info) { up.hidden = true; return; }
    up.hidden = false;
    up.style.left = info.x + 'px';
    up.style.top = info.y + 'px';
    up.classList.toggle('locked', !!info.next?.lock);
    if (info.next) {
      up.classList.remove('max');
      up.innerHTML = info.next.lock
        ? `<img src="assets/${info.next.art}.png" alt=""><b class="arrow lock">🔒</b><span class="cost">${info.next.lock}</span>`
        : `<img src="assets/${info.next.art}.png" alt=""><b class="arrow">⬆</b><span class="cost">${coinHtml}${info.next.cost}</span>`;
    } else {
      up.classList.add('max');
      up.classList.remove('poor');
      up.innerHTML = '<span class="maxtxt">MAX</span>';
    }
    boing(up, 'pop-in');
    refresh();
  });

  bus.on(Evt.GameOver, () => { $('over').hidden = false; boing($('overbox'), 'pop-in'); });
  $('again').addEventListener('click', () => location.reload());

  up.addEventListener('click', () => {
    if (!sel?.next) return;
    boing(up);
    bus.emit(Evt.Upgrade);
  });
  // clicar no botão não pode contar como clique no mapa
  for (const el of [bar, up]) el.addEventListener('pointerdown', e => e.stopPropagation());
}
