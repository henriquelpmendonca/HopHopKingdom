import { bus, Evt } from '../events';

/**
 * Comemoração no meio da tela: cada frase entra pulando, com confete, uma depois da outra
 * (ex.: "Onda 3 concluída!" e depois "Parabéns!"). Um pouco menor que a do tutorial.
 */
export function setupCelebrate() {
  const box = document.createElement('div');
  box.id = 'cheer';
  box.hidden = true;
  document.body.appendChild(box);
  let timers: number[] = [];

  const show = (text: string, big: boolean) => {
    box.className = big ? 'big' : '';
    box.innerHTML = `<b class="toon${big ? '' : ' g'}" data-t="${text}">${text}</b>` + Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2, d = 70 + Math.random() * 90;
      const c = ['#ffd84a', '#ff6f91', '#7ad0ff', '#7CFF6B', '#ff9a2a', '#d6a8ff'][i % 6];
      return `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 30}px;--r:${Math.random() * 720 - 360}deg;background:${c}"></i>`;
    }).join('');
    box.hidden = false;
    box.classList.remove('go');
    void box.offsetWidth;
    box.classList.add('go');
  };

  bus.on(Evt.Celebrate, (lines: string[]) => {
    for (const t of timers) window.clearTimeout(t);
    timers = [];
    lines.forEach((text, i) => timers.push(window.setTimeout(() => show(text, i === lines.length - 1), i * 1250)));
    timers.push(window.setTimeout(() => { box.hidden = true; }, lines.length * 1250 + 200));
  });
}
