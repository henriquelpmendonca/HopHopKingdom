import { t } from '../i18n';
import { bus, Evt } from '../events';
import { tuto } from '../state';
import { store } from '../store';

/**
 * Tutorial dos primeiros minutos, dentro do próprio jogo e sempre pulável:
 * construir a primeira cabana -> esperar os orcs -> arremessar um soldado -> bater com a espada -> evoluir a cabana.
 * O jogo avisa o que o jogador fez pelo evento Evt.Tuto; aqui só se decide o que mostrar.
 */
type Step = 'off' | 'build' | 'wait' | 'throw' | 'hit' | 'upgrade' | 'done';

const KEY = 'hhk_tuto';

export function setupTutorial() {
  const box = document.getElementById('tuto') as HTMLElement;
  const txt = document.getElementById('tutoTxt') as HTMLElement;
  const skip = document.getElementById('tutoSkip') as HTMLElement;
  const touch = matchMedia('(hover:none)').matches;
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

  /** passa para o próximo passo; `after` é o tempo (s) em que ele avança sozinho, para ninguém ficar preso */
  function go(next: Step, after = 0) {
    window.clearTimeout(timer);
    step = next;
    glow(firstSlot(), step === 'build');
    glow(upBtn(), step === 'upgrade');
    document.body.classList.toggle('tuto', step !== 'off' && step !== 'done');
    switch (step) {
      case 'build': say('tuto.build'); break;
      case 'wait': say('tuto.wait'); break;
      case 'throw': say(touch ? 'tuto.throw_touch' : 'tuto.throw_mouse'); break;
      case 'hit': hits = 0; say(touch ? 'tuto.hit_touch' : 'tuto.hit_mouse'); break;
      case 'upgrade': say('tuto.upgrade'); break;
      case 'done':
        say('tuto.done');
        finish(4500);
        return;
    }
    if (after) timer = window.setTimeout(() => advance(), after * 1000);
  }

  function advance() {
    if (step === 'throw') go('hit', 22);
    else if (step === 'hit') go('upgrade', 70);
    else if (step === 'upgrade') go('done');
    else if (step === 'wait') go('throw', 25);
  }

  function finish(delay = 0) {
    window.clearTimeout(timer);
    store.set(KEY, '1');
    tuto.on = false;
    glow(firstSlot(), false);
    glow(upBtn(), false);
    document.body.classList.remove('tuto');
    window.setTimeout(() => { box.hidden = true; step = 'off'; }, delay);
    if (!delay) { box.hidden = true; step = 'off'; }
  }

  skip.addEventListener('click', () => finish());

  bus.on(Evt.Tuto, (what: string) => {
    if (what === 'start') { go('build'); return; }
    if (step === 'off' || step === 'done') return;
    if (what === 'placed' && step === 'build') go('wait', 60);
    else if (what === 'wave' && step === 'wait') go('throw', 25);
    else if (what === 'throw' && step === 'throw') go('hit', 22);
    else if (what === 'hit' && step === 'hit' && ++hits >= 3) go('upgrade', 70);
    else if (what === 'upgrade' && step === 'upgrade') go('done');
  });

  // enquanto escolhe o lugar, o texto explica como colocar
  bus.on(Evt.Placing, (id: string | null) => {
    placing = !!id;
    if (step !== 'build') return;
    txt.textContent = t(placing ? (touch ? 'tuto.place_touch' : 'tuto.place_mouse') : 'tuto.build');
    glow(firstSlot(), !placing);
  });
}
