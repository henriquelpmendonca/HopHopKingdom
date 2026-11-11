import { sfx } from '../audio';
import { t, type Key } from '../i18n';
import { bus, Evt } from '../events';
import { tuto } from '../state';
import { store } from '../store';
import { markUiPointer } from '../camera';

/**
 * Tutorial da primeira visita, sempre pulável. O jogo já abre em ação e cada passo tem o que fazer na hora:
 * bater nos orcs -> arremessar um soldado -> evoluir a cabana -> (vitrine das evoluções) -> construir outra -> objetivo.
 * Cada passo tem ícone animado e bolinhas de progresso; cada acerto ganha uma comemoração.
 * A cena avisa o que o jogador fez pelo evento Evt.Tuto e, a cada passo, recebe step:<passo> para preparar a tela.
 */
type Step = 'off' | 'hit' | 'throw' | 'upgrade' | 'info' | 'show' | 'build' | 'done';

const KEY = 'hhk_tuto';
/** segundos até o passo avançar sozinho, para ninguém ficar preso */
const LIMIT: Partial<Record<Step, number>> = { hit: 18, throw: 20, upgrade: 18, info: 25, build: 25 };
const HITS = 3;
const ORDER: Step[] = ['hit', 'throw', 'upgrade', 'info', 'build'];
const ICON: Partial<Record<Step, string>> = { hit: 'espada_2', throw: 'soldado', upgrade: 'cabana_soldado_2', info: 'st_dano', build: 'cabana_soldado_1', done: 'castelo_3' };

export function setupTutorial() {
  const box = document.getElementById('tuto') as HTMLElement;
  const txt = document.getElementById('tutoTxt') as HTMLElement;
  const skip = document.getElementById('tutoSkip') as HTMLElement;
  const touch = matchMedia('(hover:none)').matches;

  // ícone animado e bolinhas de progresso dentro da caixa do tutorial
  const ico = document.createElement('img');
  ico.id = 'tutoIco';
  ico.alt = '';
  box.prepend(ico);
  const dots = document.createElement('span');
  dots.id = 'tutoDots';
  dots.innerHTML = ORDER.map(() => '<i></i>').join('');
  txt.after(dots);

  const hand = document.createElement('img');
  hand.id = 'tutoHand';
  hand.src = 'assets/luva.png';
  hand.draggable = false;
  hand.hidden = true;
  document.body.appendChild(hand);

  // "Boa!" com confete no meio da tela
  const praise = document.createElement('div');
  praise.id = 'praise';
  praise.hidden = true;
  document.body.appendChild(praise);

  const evo = buildShowcase();
  box.addEventListener('pointerdown', markUiPointer);

  let step: Step = 'off';
  let hits = 0;
  let timer = 0;
  let placing = false;
  let niceN = 0;

  const glow = (el: Element | null, on: boolean) => el?.classList.toggle('tuto-glow', on);
  const firstSlot = () => document.querySelector('#bar .slot');
  const upBtn = () => document.getElementById('upgrade');
  const infoBtn = () => document.getElementById('infoBtn');

  function say(key: Key) {
    txt.textContent = t(key);
    const art = ICON[step];
    ico.hidden = !art;
    if (art) ico.src = `assets/${art}.png`;
    ico.className = 'ico-' + step;
    const at = ORDER.indexOf(step);
    dots.querySelectorAll('i').forEach((d, i) => d.className = step === 'done' || i < at ? 'ok' : i === at ? 'now' : '');
    box.hidden = false;
    box.classList.remove('pop');
    void box.offsetWidth;
    box.classList.add('pop');
  }

  function cheer() {
    const words: Key[] = ['tuto.nice1', 'tuto.nice2', 'tuto.nice3'];
    const word = t(words[niceN++ % words.length]);
    praise.innerHTML = `<b class="toon" data-t="${word}">${word}</b>` +
      Array.from({ length: 26 }, (_, i) => {
        const a = (i / 26) * Math.PI * 2, d = 90 + Math.random() * 110;
        const c = ['#ffd84a', '#ff6f91', '#7ad0ff', '#7CFF6B', '#ff9a2a'][i % 5];
        return `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 40}px;--r:${Math.random() * 720 - 360}deg;background:${c}"></i>`;
      }).join('');
    praise.hidden = false;
    praise.classList.remove('go');
    void praise.offsetWidth;
    praise.classList.add('go');
    sfx.upgrade(false);
    window.setTimeout(() => { praise.hidden = true; }, 1300);
  }

  function go(next: Step, celebrate = false) {
    window.clearTimeout(timer);
    if (celebrate) cheer(); else if (step !== 'off') sfx.ui();
    step = next;
    tuto.step = next;
    tuto.foes = next === 'hit' || next === 'throw';
    glow(firstSlot(), step === 'build');
    glow(upBtn(), step === 'upgrade');
    glow(infoBtn(), step === 'info');
    document.body.classList.add('tuto');
    switch (step) {
      case 'hit': hits = 0; say(touch ? 'tuto.hit_touch' : 'tuto.hit_mouse'); break;
      case 'throw': say(touch ? 'tuto.throw_touch' : 'tuto.throw_mouse'); break;
      case 'upgrade': say('tuto.upgrade'); break;
      case 'info': say('tuto.info'); break;
      case 'show':
        bus.emit(Evt.InfoClose);
        box.hidden = true;
        evo.open(() => go('build'));
        return;
      case 'build': placing = false; say('tuto.build'); break;
      case 'done':
        say('tuto.done');
        finish(5500);
        return;
    }
    bus.emit(Evt.Tuto, 'step:' + step);
    const s = LIMIT[step];
    if (s) timer = window.setTimeout(advance, s * 1000);
  }

  function advance() {
    if (step === 'hit') go('throw');
    else if (step === 'throw') go('upgrade');
    else if (step === 'upgrade') go('info');
    else if (step === 'info') go('show');
    else if (step === 'build') go('done');
  }

  function finish(delay = 0) {
    window.clearTimeout(timer);
    store.set(KEY, '1');
    tuto.on = false;
    tuto.step = '';
    tuto.foes = false;
    tuto.aim = null;
    glow(firstSlot(), false);
    glow(upBtn(), false);
    glow(infoBtn(), false);
    bus.emit(Evt.InfoClose);
    document.body.classList.remove('tuto');
    hand.hidden = true;
    evo.close(false);
    bus.emit(Evt.Tuto, 'end');
    const close = () => { box.hidden = true; step = 'off'; };
    if (delay) window.setTimeout(close, delay); else close();
  }

  /** A mão mostra o gesto: toca no alvo ou arrasta do soldado até o orc. */
  function drawHand(now: number) {
    if (step === 'off' || step === 'done') { hand.hidden = true; return; }
    let a = tuto.aim;
    const dom = step === 'build' && !placing ? firstSlot() : step === 'upgrade' ? upBtn() : step === 'info' ? infoBtn() : null;
    if (dom) {
      const r = dom.getBoundingClientRect();
      a = r.width ? { ax: r.x + r.width * 0.55, ay: r.y + r.height * 0.5 } : null;
    }
    if (step === 'show') a = null;
    hand.hidden = !a;
    if (a) {
      const ph = (now % 1300) / 1300;
      let x = a.ax, y = a.ay, s = 1 - 0.16 * Math.max(0, Math.sin(ph * Math.PI * 2));
      if (a.bx !== undefined && a.by !== undefined) {
        const k = ph < 0.2 ? 0 : ph < 0.75 ? (ph - 0.2) / 0.55 : 1;
        const e = k * k * (3 - 2 * k);
        x += (a.bx - a.ax) * e;
        y += (a.by - a.ay) * e;
        s = ph < 0.1 ? 1 : 0.84;
      }
      hand.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    }
    requestAnimationFrame(drawHand);
  }

  skip.addEventListener('click', () => finish());

  bus.on(Evt.Tuto, (what: string) => {
    if (what === 'start') { showIntro(); go('hit'); requestAnimationFrame(drawHand); return; }
    if (what === 'hit' && step === 'hit' && ++hits >= HITS) go('throw', true);
    else if (what === 'throw' && step === 'throw') go('upgrade', true);
    else if (what === 'upgrade' && step === 'upgrade') { cheer(); window.clearTimeout(timer); timer = window.setTimeout(() => go('info'), 900); }
    else if (what === 'info' && step === 'info') { say('tuto.info2'); window.clearTimeout(timer); timer = window.setTimeout(() => go('show'), 14000); }
    else if (what === 'infoclosed' && step === 'info') go('show');
    else if (what === 'placed' && step === 'build') go('done', true);
  });

  // enquanto escolhe o lugar, o texto explica como colocar
  bus.on(Evt.Placing, (id: string | null) => {
    placing = !!id;
    if (step !== 'build') return;
    txt.textContent = t(placing ? (touch ? 'tuto.place_touch' : 'tuto.place_mouse') : 'tuto.build');
    glow(firstSlot(), !placing);
  });
}

/** Abertura: o logo cai, quica e some, por cima do jogo que já está rodando (não bloqueia nada). */
function showIntro() {
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `<img src="assets/logo.png" alt="Hop Hop Kingdom"><b class="toon" data-t="${t('intro.tag')}">${t('intro.tag')}</b>`;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 2600);
}

/**
 * Vitrine das evoluções: depois da primeira melhoria, mostra tudo o que a cabana (e o castelo) podem virar.
 * Os itens entram um a um, com brilho girando atrás das casas especiais.
 */
function buildShowcase() {
  const ov = document.createElement('div');
  ov.id = 'evoShow';
  ov.hidden = true;
  const item = (art: string, label: string, d: number, special = false, unit?: string) =>
    `<figure class="${special ? 'sp' : ''}" style="--d:${d}ms"><span class="pic"><img src="assets/${art}.png" alt="">` +
    (unit ? `<img class="unit" src="assets/${unit}.png" alt="">` : '') + `</span><figcaption>${label}</figcaption></figure>`;
  const arrow = (d: number) => `<i class="arr" style="--d:${d}ms">➜</i>`;
  const lv = (n: number) => t('ui.level', { n });
  ov.innerHTML = `<div id="evoCard"><h2>${t('evo.title')}</h2>
    <div class="evoRow"><p>${t('evo.hut')}</p><div class="evoItems">
      ${item('cabana_soldado_1', lv(1), 200, false, 'soldado')}${arrow(330)}${item('cabana_soldado_2', lv(5), 420, false, 'soldado_lanca')}${arrow(550)}${item('cabana_soldado_3', lv(10), 640, false, 'soldado_alabarda')}
    </div></div>
    <div class="evoRow"><p>${t('evo.special')}</p><div class="evoItems">
      ${item('cabana_gigante_1', t('evo.k_gigante'), 900, true, 'soldado_gigante')}${item('cabana_bomba_1', t('evo.k_bomba'), 1050, true, 'soldado_bomba')}${item('cabana_quicador_1', t('evo.k_quicador'), 1200, true, 'soldado_quicador')}${item('cabana_gelo_1', t('evo.k_gelo'), 1350, true, 'soldado_gelo')}
    </div></div>
    <div class="evoRow"><p>${t('evo.castle')}</p><div class="evoItems">
      ${item('castelo', lv(1), 1600)}${arrow(1720)}${item('castelo_3', lv(3), 1800)}${arrow(1920)}${item('castelo_6', lv(6), 2000, true)}
    </div></div>
    <button id="evoGo">${t('evo.go')}</button></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('pointerdown', markUiPointer);
  let done: (() => void) | null = null;
  let timer = 0;
  const close = (run = true) => {
    if (ov.hidden) return;
    window.clearTimeout(timer);
    ov.hidden = true;
    const f = done;
    done = null;
    if (run) f?.();
  };
  // só fecha depois que tudo apareceu, para ninguém pular sem querer
  let openedAt = 0;
  ov.addEventListener('click', () => { if (performance.now() - openedAt > 1200) { sfx.ui(); close(); } });
  return {
    open(next: () => void) {
      done = next;
      ov.hidden = false;
      ov.classList.remove('go');
      void ov.offsetWidth;
      ov.classList.add('go');
      openedAt = performance.now();
      sfx.upgrade(true);
      timer = window.setTimeout(() => close(), 11000);
    },
    close,
  };
}
