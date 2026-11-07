import { sfx } from '../audio';
import { t } from '../i18n';
import { bus, Evt } from '../events';
import { tuto } from '../state';
import { store } from '../store';

/**
 * Tutorial da primeira visita, sempre pulável. O jogo já abre em ação e cada passo tem o que fazer na hora:
 * bater nos orcs -> arremessar um soldado -> evoluir a cabana -> construir outra -> próximo objetivo.
 * A cena avisa o que o jogador fez pelo evento Evt.Tuto e, a cada passo, recebe step:<passo> para preparar a tela.
 */
type Step = 'off' | 'hit' | 'throw' | 'upgrade' | 'build' | 'done';

const KEY = 'hhk_tuto';
/** segundos até o passo avançar sozinho, para ninguém ficar preso */
const LIMIT: Partial<Record<Step, number>> = { hit: 18, throw: 20, upgrade: 18, build: 25 };
const HITS = 3;

export function setupTutorial() {
  const box = document.getElementById('tuto') as HTMLElement;
  const txt = document.getElementById('tutoTxt') as HTMLElement;
  const skip = document.getElementById('tutoSkip') as HTMLElement;
  const touch = matchMedia('(hover:none)').matches;
  const hand = document.createElement('img');
  hand.id = 'tutoHand';
  hand.src = 'assets/luva.png';
  hand.draggable = false;
  hand.hidden = true;
  document.body.appendChild(hand);
  let step: Step = 'off';
  let hits = 0;
  let timer = 0;
  let placing = false;

  const glow = (el: Element | null, on: boolean) => el?.classList.toggle('tuto-glow', on);
  const firstSlot = () => document.querySelector('#bar .slot');
  const upBtn = () => document.getElementById('upgrade');

  function say(key: Parameters<typeof t>[0]) {
    txt.textContent = t(key);
    box.hidden = false;
    box.classList.remove('pop');
    void box.offsetWidth;
    box.classList.add('pop');
  }

  function go(next: Step) {
    window.clearTimeout(timer);
    if (step !== 'off') sfx.ui();
    step = next;
    tuto.step = next;
    tuto.foes = next === 'hit' || next === 'throw';
    glow(firstSlot(), step === 'build');
    glow(upBtn(), step === 'upgrade');
    document.body.classList.add('tuto');
    switch (step) {
      case 'hit': hits = 0; say(touch ? 'tuto.hit_touch' : 'tuto.hit_mouse'); break;
      case 'throw': say(touch ? 'tuto.throw_touch' : 'tuto.throw_mouse'); break;
      case 'upgrade': say('tuto.upgrade'); break;
      case 'build': placing = false; say('tuto.build'); break;
      case 'done':
        say('tuto.done');
        finish(5000);
        return;
    }
    bus.emit(Evt.Tuto, 'step:' + step);
    const s = LIMIT[step];
    if (s) timer = window.setTimeout(advance, s * 1000);
  }

  function advance() {
    if (step === 'hit') go('throw');
    else if (step === 'throw') go('upgrade');
    else if (step === 'upgrade') go('build');
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
    document.body.classList.remove('tuto');
    hand.hidden = true;
    bus.emit(Evt.Tuto, 'end');
    const close = () => { box.hidden = true; step = 'off'; };
    if (delay) window.setTimeout(close, delay); else close();
  }

  /** A mão mostra o gesto: toca no alvo ou arrasta do soldado até o orc. */
  function drawHand(now: number) {
    if (step === 'off' || step === 'done') { hand.hidden = true; return; }
    let a = tuto.aim;
    const dom = step === 'build' && !placing ? firstSlot() : step === 'upgrade' ? upBtn() : null;
    if (dom) {
      const r = dom.getBoundingClientRect();
      a = r.width ? { ax: r.x + r.width * 0.55, ay: r.y + r.height * 0.5 } : null;
    }
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
    if (what === 'start') { go('hit'); requestAnimationFrame(drawHand); return; }
    if (what === 'hit' && step === 'hit' && ++hits >= HITS) go('throw');
    else if (what === 'throw' && step === 'throw') go('upgrade');
    else if (what === 'upgrade' && step === 'upgrade') go('build');
    else if (what === 'placed' && step === 'build') go('done');
  });

  // enquanto escolhe o lugar, o texto explica como colocar
  bus.on(Evt.Placing, (id: string | null) => {
    placing = !!id;
    if (step !== 'build') return;
    txt.textContent = t(placing ? (touch ? 'tuto.place_touch' : 'tuto.place_mouse') : 'tuto.build');
    glow(firstSlot(), !placing);
  });
}
