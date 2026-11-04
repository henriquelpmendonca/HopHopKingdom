import { audio, sfx } from '../audio';
import { t, type Key } from '../i18n';
import { sdk } from '../sdk';
import { REBUILD_COIN_KEEP, rebuildBack } from '../config';
import { clearSave } from '../save';
import { BUILDABLES } from '../data/cabanas';
import { MAGIC_CASTLE_LEVEL } from '../data/castle';
import { POWERS, POWER_FREEZE_SECONDS } from '../data/powers';
import { SWORD_MAX, swordCost, swordDamage, swordTier } from '../data/sword';
import { bus, Evt, SelectInfo } from '../events';
import { anyAffordable, getStars } from '../meta';

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
    el.title = t(`name.${def.id}` as Key);
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
  sw.title = t('ui.sword_upgrade');
  bar.appendChild(sw);
  let swordLevel = 1;
  function drawSword() {
    const tier = swordTier(swordLevel);
    const max = swordLevel >= SWORD_MAX;
    sw.innerHTML = `<img src="assets/${tier.art}.png" alt=""><b class="lv">${t('ui.level', { n: swordLevel })}</b>`
      + (max ? `<span class="cost">${t('ui.max')}</span>`
        : `<b class="arrow">⬆</b><span class="cost">${coinHtml}${swordCost(swordLevel)}</span>`);
    sw.title = t('ui.sword_info', { n: swordDamage(swordLevel) });
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
      // preço -1 = construção única que já existe: a carta sai da barra (e volta se ela for destruída ou vendida)
      s.el.classList.toggle('gone', cost < 0);
      if (cost < 0) continue;
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
    b.title = t('power.key', { name: t(`power.${p.id}.name` as Key), k: keys[i], desc: t(`power.${p.id}.desc` as Key, { n: POWER_FREEZE_SECONDS }) });
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

  // próxima onda
  bus.on(Evt.Countdown, (n: number | null) => {
    $('nextN').textContent = n === null ? '' : t('ui.next_wave', { n });
  });

  // pausa: botão, tecla P e tela de pausa
  const pauseBox = $('pause');
  const setPause = (on: boolean) => {
    if (on && ($('over').hidden === false || !pauseBox.hidden)) return;
    pauseBox.hidden = !on;
    $('pauseBtn').classList.toggle('paused', on);
    bus.emit(Evt.Pause, on);
  };
  $('pauseBtn').addEventListener('click', () => { sfx.ui(); setPause(pauseBox.hidden !== false); });
  $('resume').addEventListener('click', () => { sfx.ui(); setPause(false); });
  window.addEventListener('keydown', e => { if (e.code === 'KeyP' && !e.repeat) setPause(pauseBox.hidden !== false); });

  bus.on(Evt.Wave, (n: number) => {
    const el = $('waveN');
    if (el.textContent !== String(n)) boing($('wave'), 'bump');
    el.textContent = String(n);
  });

  // roda de botões ao redor da cabana: evoluir em cima, mover e vender embaixo dos lados
  const mv = $('moveBtn'), sl = $('sellBtn');
  const evoBtns = ['evoA', 'evoB', 'evoC', 'evoD'].map(id => $(id));
  // [botão, ângulo, fator do raio]: os de evoluir ficam num arco mais afastado, em cima
  const ringItems: [HTMLElement, number, number][] = [[up, -90, 1], [mv, 150, 1], [sl, 30, 1], ...evoBtns.map((b, i): [HTMLElement, number, number] => [b, -150 + i * 40, 1.55])];
  let evo: SelectInfo['evolve'];
  let ring = { x: 0, y: 0, r: 90 };
  let selKey = '';
  let emerge = false;
  let emergeTimer = 0;
  let tools: SelectInfo['tools'];
  let sellArmed = 0;

  function placeRing(center: boolean) {
    const maxY = window.innerHeight - bar.offsetHeight - 24;
    for (const [el, deg, rm] of ringItems) {
      if (el.hidden) continue;
      const a = deg * Math.PI / 180;
      const x = center ? ring.x : ring.x + Math.cos(a) * ring.r * rm;
      let y = center ? ring.y : ring.y + Math.sin(a) * ring.r * rm;
      y = Math.max(54, Math.min(y, maxY));
      el.style.left = x + 'px';
      // os botões ancoram pela base: soma meia altura para o centro cair no círculo
      el.style.top = (y + el.offsetHeight / 2) + 'px';
    }
  }

  bus.on(Evt.SelPos, (x: number, y: number, r: number) => {
    ring = { x, y, r };
    if (emerge) {
      // começa tudo no meio da cabana e, com a transição ligada, os botões saem para o círculo
      emerge = false;
      for (const [el] of ringItems) el.classList.remove('emerge');
      placeRing(true);
      void up.offsetWidth;
      for (const [el] of ringItems) el.classList.add('emerge');
      window.clearTimeout(emergeTimer);
      emergeTimer = window.setTimeout(() => { for (const [el] of ringItems) el.classList.remove('emerge'); }, 650);
    }
    placeRing(false);
  });

  function drawTools() {
    if (!tools) return;
    const cur = tools.mana ? gemHtml : coinHtml;
    mv.innerHTML = `<b class="ico">↔</b><span class="cost">${cur}${tools.move}</span>`;
    sl.innerHTML = sellArmed
      ? `<b class="ico">❓</b><span class="cost">${t('ui.sell_sure')}</span>`
      : `<b class="ico">💰</b><span class="cost">+${cur}${tools.refund}</span>`;
    mv.title = t('ui.move');
    sl.title = t('ui.sell');
    mv.classList.toggle('poor', !tools.ok);
    sl.classList.toggle('poor', !tools.ok);
    sl.classList.toggle('confirm', !!sellArmed);
  }
  // evoluir a cabana para uma casa de soldados especiais (precisa da Casa de Estudo)
  function drawEvo() {
    evoBtns.forEach((b, i) => {
      const e = evo?.[i];
      b.hidden = !e;
      if (!e) return;
      b.innerHTML = `<img src="assets/${e.art}.png" alt=""><span class="cost">${e.lock ? '🔒 ' + e.lock : gemHtml + e.cost}</span>`;
      b.title = t('ui.evolve', { name: e.name });
      b.classList.toggle('poor', !e.ok);
    });
  }
  evoBtns.forEach((b, i) => b.addEventListener('click', () => {
    sfx.ui();
    boing(b);
    const e = evo?.[i];
    if (e) bus.emit(Evt.Evolve, e.id);
  }));
  function disarm() { window.clearTimeout(sellArmed); sellArmed = 0; drawTools(); }
  mv.addEventListener('click', () => { sfx.ui(); boing(mv); disarm(); bus.emit(Evt.Move); });
  sl.addEventListener('click', () => {
    sfx.ui();
    boing(sl);
    // vender pede um segundo toque, para ninguém perder uma cabana evoluída sem querer
    if (!tools?.ok) { bus.emit(Evt.Sell); return; }
    if (!sellArmed) { sellArmed = window.setTimeout(disarm, 2800); drawTools(); return; }
    disarm();
    bus.emit(Evt.Sell);
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
    if (!info) { up.hidden = true; mv.hidden = true; sl.hidden = true; evoBtns.forEach(b => { b.hidden = true; }); tools = undefined; evo = undefined; selKey = ''; disarm(); return; }
    if (info.key !== selKey) { selKey = info.key; emerge = true; disarm(); }
    tools = info.tools;
    mv.hidden = sl.hidden = !tools;
    drawTools();
    evo = info.evolve;
    drawEvo();
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
      up.innerHTML = `<span class="maxtxt">${t('ui.max')}</span>`;
    }
    boing(up, 'pop-in');
    refresh();
  });

  bus.on(Evt.GameOver, (info: { wave: number; kills: number; best: number }) => {
    $('overStats').textContent = t('ui.over_stats', { k: info.kills, b: info.best });
    pauseBox.hidden = true;
    const stars = getStars();
    $('overStars').textContent = stars > 0 ? '⭐ ' + t('ui.over_stars', { n: stars }) : '';
    $('overForge').classList.toggle('ready', anyAffordable());
    $('overTxt').textContent = t('ui.over_txt', { w: info.wave, p: Math.round((1 - REBUILD_COIN_KEEP) * 100), n: rebuildBack(info.wave) });
    // reerguer de graça só aparece se houver anúncio com recompensa disponível
    $('rebuildFree').hidden = !sdk.adsAvailable;
    $('over').hidden = false;
    boing($('overbox'), 'pop-in');
  });
  // anúncio entre a derrota e a próxima parte (o SDK ignora se for cedo demais)
  $('rebuild').addEventListener('click', () => {
    sfx.ui();
    $('over').hidden = true;
    sdk.midgame(() => bus.emit(Evt.Rebuild, { free: false }));
  });
  $('rebuildFree').addEventListener('click', () => {
    sfx.ui();
    sdk.rewarded(() => { $('over').hidden = true; bus.emit(Evt.Rebuild, { free: true }); }, () => {
      $('rebuildFree').hidden = !sdk.adsAvailable;
      if ($('over').hidden === false) { bus.emit(Evt.Hint, t('hint.ad_unavailable')); window.setTimeout(() => bus.emit(Evt.Hint, null), 3000); }
    });
  });
  $('overForge').addEventListener('click', () => { sfx.ui(); bus.emit(Evt.OpenForge); });
  // ao fechar a Forja a tela de derrota continua com os números novos
  bus.on(Evt.Stars, () => {
    const s = getStars();
    $('overStars').textContent = s > 0 ? '⭐ ' + t('ui.over_stars', { n: s }) : '';
  });
  $('again').addEventListener('click', () => { clearSave(); sdk.midgame(() => location.reload()); });

  // presente de moedas por anúncio (só onde há anúncios), com espera de 3 minutos
  const gift = $('gift') as HTMLButtonElement;
  gift.hidden = !sdk.adsAvailable;
  gift.addEventListener('click', () => {
    sfx.ui();
    gift.disabled = true;
    sdk.rewarded(() => {
      bus.emit(Evt.Gift);
      gift.classList.add('cooling');
      window.setTimeout(() => { gift.classList.remove('cooling'); gift.disabled = false; }, 180000);
    }, () => { gift.disabled = false; gift.hidden = !sdk.adsAvailable; bus.emit(Evt.Hint, t('hint.ad_unavailable')); window.setTimeout(() => bus.emit(Evt.Hint, null), 3000); });
  });

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
  for (const el of [bar, up, mv, sl, ...evoBtns, $('audio')]) el.addEventListener('pointerdown', e => e.stopPropagation());
}
