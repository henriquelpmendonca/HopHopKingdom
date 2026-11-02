import { audio, sfx } from '../audio';
import { REBUILD_COIN_KEEP, REBUILD_WAVES_BACK } from '../config';
import { clearSave } from '../save';
import { BUILDABLES } from '../data/cabanas';
import { MAGIC_CASTLE_LEVEL } from '../data/castle';
import { POWERS } from '../data/powers';
import { SWORD_MAX, swordCost, swordDamage, swordTier } from '../data/sword';
import { bus, Evt, SelectInfo } from '../events';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const coinHtml = '<i class="coin"></i>';
const gemHtml = '<i class="gem"></i>';

function boing(el: HTMLElement, cls = 'boing') {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Barra de construção, contador de moedas, botão verde de upgrade e dica. */
export function setupHud() {
  const bar = $('bar'), coins = $('coinN'), hint = $('hint'), up = $('upgrade');
  // a barra muda de altura no celular: a dica sobe junto
  const syncBar = () => document.documentElement.style.setProperty('--bar', bar.offsetHeight + 'px');
  window.addEventListener('resize', syncBar);
  window.addEventListener('orientationchange', syncBar);
  let coinsNow = 0;
  let manaNow = 0;
  let castleLv = 1;
  let sel: SelectInfo | null = null;
  const slots = new Map<string, { el: HTMLButtonElement; cost: number; mana: boolean; need: number }>();
  const powerBtns = new Map<string, HTMLButtonElement>();

  for (const def of BUILDABLES) {
    const el = document.createElement('button');
    el.className = 'slot';
    el.title = def.nome;
    const mana = def.currency === 'mana';
    el.innerHTML = `<img src="assets/${def.levels[0].art}.png" alt=""><span class="cost">${mana ? gemHtml : coinHtml}${def.levels[0].cost}</span>`;
    el.addEventListener('click', () => { boing(el); sfx.ui(); bus.emit(Evt.Build, def.id); });
    // construções que dependem do Centro da Vila ficam escondidas até ele chegar lá
    if (def.needCastle) el.classList.add('hide');
    bar.appendChild(el);
    slots.set(def.id, { el, cost: def.levels[0].cost, mana, need: def.needCastle ?? 0 });
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
    for (const s of slots.values()) s.el.classList.toggle('poor', (s.mana ? manaNow : coinsNow) < s.cost);
    for (const [pid, b] of powerBtns) b.classList.toggle('poor', manaNow < (POWERS.find(p => p.id === pid)?.cost ?? 0));
    sw.classList.toggle('poor', swordLevel < SWORD_MAX && coinsNow < swordCost(swordLevel));
    if (sel?.next) up.classList.toggle('poor', !sel.next.lock && (sel.next.mana ? manaNow : coinsNow) < sel.next.cost);
  }

  bus.on(Evt.Coins, (n: number) => {
    if (n !== coinsNow) boing(coins.parentElement as HTMLElement, 'bump');
    coinsNow = n;
    coins.textContent = String(n);
    refresh();
  });

  // o preço de algumas construções sobe com quantas você já tem
  bus.on(Evt.BuildCosts, (costs: Record<string, number>) => {
    for (const [id, cost] of Object.entries(costs)) {
      const s = slots.get(id);
      if (!s) continue;
      s.cost = cost;
      const label = s.el.querySelector('.cost');
      if (label) label.innerHTML = (s.mana ? gemHtml : coinHtml) + cost;
    }
    refresh();
  });

  // mana e poderes: aparecem quando o Centro da Vila chega ao nível 4
  const keys = ['1', '2', '3'];
  POWERS.forEach((p, i) => {
    const b = document.createElement('button');
    // cartas dos poderes ficam na barra, ao lado da espada; só aparecem com o Centro da Vila nível 4
    b.className = 'slot power hide';
    b.title = `${p.nome} (tecla ${keys[i]}): ${p.desc}`;
    b.innerHTML = `<img src="assets/${p.art}.png" alt=""><b class="key">${keys[i]}</b><span class="cost">${gemHtml}${p.cost}</span>`;
    b.addEventListener('click', () => { boing(b); sfx.ui(); bus.emit(Evt.Power, p.id); });
    bar.appendChild(b);
    powerBtns.set(p.id, b);
  });
  bus.on(Evt.PowerCd, (id: string, sec: number) => {
    const b = powerBtns.get(id);
    if (!b) return;
    b.style.setProperty('--cd', sec + 's');
    b.classList.remove('cooling');
    void b.offsetWidth;
    b.classList.add('cooling');
    window.setTimeout(() => b.classList.remove('cooling'), sec * 1000);
  });
  bus.on(Evt.Castle, (lv: number) => {
    castleLv = lv;
    for (const s of slots.values()) if (s.need) s.el.classList.toggle('hide', castleLv < s.need);
    $('mana').hidden = castleLv < MAGIC_CASTLE_LEVEL;
    for (const b of powerBtns.values()) b.classList.toggle('hide', castleLv < MAGIC_CASTLE_LEVEL);
  });
  bus.on(Evt.Mana, (n: number, inc: number) => {
    manaNow = n;
    $('manaN').textContent = String(Math.floor(n));
    $('manaInc').textContent = inc > 0 ? '+' + (Math.round(inc * 10) / 10) + '/s' : '';
    refresh();
  });

  bus.on(Evt.Wave, (n: number) => {
    const el = $('waveN');
    if (el.textContent !== String(n)) boing($('wave'), 'bump');
    el.textContent = String(n);
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
    const el = id === 'upgrade' ? up : id === 'sword' ? sw : id.startsWith('power:') ? powerBtns.get(id.slice(6)) : slots.get(id)?.el;
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
        : `<img src="assets/${info.next.art}.png" alt=""><b class="arrow">⬆</b><span class="cost">${info.next.mana ? gemHtml : coinHtml}${info.next.cost}</span>`;
    } else {
      up.classList.add('max');
      up.classList.remove('poor');
      up.innerHTML = '<span class="maxtxt">MAX</span>';
    }
    boing(up, 'pop-in');
    refresh();
  });

  bus.on(Evt.GameOver, (info: { wave: number }) => {
    $('overTxt').textContent = `Você chegou à onda ${info.wave}. Reerguendo, você mantém suas construções, `
      + `mas perde ${Math.round((1 - REBUILD_COIN_KEEP) * 100)}% das moedas e volta ${REBUILD_WAVES_BACK} ondas.`;
    $('over').hidden = false;
    boing($('overbox'), 'pop-in');
  });
  $('rebuild').addEventListener('click', () => { sfx.ui(); $('over').hidden = true; bus.emit(Evt.Rebuild); });
  $('again').addEventListener('click', () => { clearSave(); location.reload(); });

  up.addEventListener('click', () => {
    if (!sel?.next) return;
    boing(up);
    sfx.ui();
    bus.emit(Evt.Upgrade);
  });
  syncBar();
  // botões de música e de efeitos sonoros
  const musicBtn = $('musicBtn'), sfxBtn = $('sfxBtn');
  const paintAudio = () => {
    musicBtn.classList.toggle('off', !audio.musicOn);
    sfxBtn.classList.toggle('off', !audio.sfxOn);
  };
  musicBtn.addEventListener('click', () => { audio.unlock(); audio.setMusic(!audio.musicOn); paintAudio(); });
  sfxBtn.addEventListener('click', () => { audio.unlock(); audio.setSfx(!audio.sfxOn); paintAudio(); if (audio.sfxOn) sfx.ui(); });
  paintAudio();

  // a barra tem muitas cartas: no celular rola com o dedo; com o mouse, segure e arraste para o lado
  let drag: { x: number; left: number; moved: boolean } | null = null;
  let noClickUntil = 0;
  bar.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') drag = { x: e.clientX, left: bar.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) bar.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    // soltar depois de arrastar não pode contar como clique numa carta
    if (drag?.moved) noClickUntil = performance.now() + 80;
    drag = null;
  });
  bar.addEventListener('click', e => {
    if (performance.now() < noClickUntil) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  // clicar no botão não pode contar como clique no mapa
  for (const el of [bar, up, $('audio')]) el.addEventListener('pointerdown', e => e.stopPropagation());
}
