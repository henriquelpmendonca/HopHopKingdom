import { audio, sfx } from '../audio';
import { BUILDABLES } from '../data/cabanas';
import { SWORD_MAX, swordCost, swordDamage, swordTier } from '../data/sword';
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
    el.addEventListener('click', () => { boing(el); sfx.ui(); bus.emit(Evt.Build, def.id); });
    bar.appendChild(el);
    slots.set(def.id, { el, cost: def.levels[0].cost });
  }

  // carta da espada do clique, separada das construções por um espaço
  const gap = document.createElement('div');
  gap.className = 'gap';
  bar.appendChild(gap);
  const sw = document.createElement('button');
  sw.className = 'slot weapon';
  sw.title = 'Evoluir a espada do clique';
  bar.appendChild(sw);
  let swordLevel = 1;
  function drawSword() {
    const t = swordTier(swordLevel);
    const max = swordLevel >= SWORD_MAX;
    sw.innerHTML = `<img src="assets/${t.art}.png" alt=""><b class="lv">Nv ${swordLevel}</b>`
      + (max ? '<span class="cost">MAX</span>'
        : `<b class="arrow">⬆</b><span class="cost">${coinHtml}${swordCost(swordLevel)}</span>`);
    sw.title = `Espada do clique: ${swordDamage(swordLevel)} de dano`;
  }
  drawSword();
  sw.addEventListener('click', () => { boing(sw); sfx.ui(); bus.emit(Evt.UpgradeSword); });
  bus.on(Evt.Sword, (lv: number) => {
    const up = lv > swordLevel;
    swordLevel = lv;
    drawSword();
    refresh();
    if (up) boing(sw, 'pop-in');
  });

  function refresh() {
    for (const s of slots.values()) s.el.classList.toggle('poor', coinsNow < s.cost);
    sw.classList.toggle('poor', swordLevel < SWORD_MAX && coinsNow < swordCost(swordLevel));
    if (sel?.next) up.classList.toggle('poor', !sel.next.lock && coinsNow < sel.next.cost);
  }

  bus.on(Evt.Coins, (n: number) => {
    if (n !== coinsNow) boing(coins.parentElement as HTMLElement, 'bump');
    coinsNow = n;
    coins.textContent = String(n);
    refresh();
  });

  bus.on(Evt.SelPos, (x: number, y: number) => {
    up.style.left = x + 'px';
    up.style.top = y + 'px';
  });

  bus.on(Evt.Income, (n: number) => { $('incomeN').textContent = '+' + n + '/s'; });

  bus.on(Evt.Placing, (id: string | null) => {
    for (const [k, s] of slots) s.el.classList.toggle('active', k === id);
  });

  bus.on(Evt.Hint, (text: string | null) => {
    hint.style.opacity = text ? '1' : '0';
    if (text) hint.textContent = text;
  });

  bus.on(Evt.Broke, (id: string) => {
    const el = id === 'upgrade' ? up : id === 'sword' ? sw : slots.get(id)?.el;
    if (el) boing(el, 'shake');
    sfx.error();
    boing($('coins'), 'shake');
  });

  bus.on(Evt.Select, (info: SelectInfo | null) => {
    sel = info;
    if (!info) { up.hidden = true; return; }
    up.hidden = false;
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
    sfx.ui();
    bus.emit(Evt.Upgrade);
  });
  // botões de música e de efeitos sonoros
  const musicBtn = $('musicBtn'), sfxBtn = $('sfxBtn');
  const paintAudio = () => {
    musicBtn.classList.toggle('off', !audio.musicOn);
    sfxBtn.classList.toggle('off', !audio.sfxOn);
  };
  musicBtn.addEventListener('click', () => { audio.unlock(); audio.setMusic(!audio.musicOn); paintAudio(); });
  sfxBtn.addEventListener('click', () => { audio.unlock(); audio.setSfx(!audio.sfxOn); paintAudio(); if (audio.sfxOn) sfx.ui(); });
  paintAudio();

  // clicar no botão não pode contar como clique no mapa
  for (const el of [bar, up, $('audio')]) el.addEventListener('pointerdown', e => e.stopPropagation());
}
