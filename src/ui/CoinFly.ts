import { bus, Evt } from '../events';

/**
 * Moedinhas que voam do lugar onde foram ganhas até o contador lá em cima.
 * É só enfeite (o valor já entrou no saldo): mostra de onde vem o dinheiro e deixa cada vitória mais gostosa.
 */
const MAX_LIVE = 18;

export function setupCoinFly() {
  const target = document.querySelector('#coins .coin') as HTMLElement | null;
  const pill = document.getElementById('coins');
  let live = 0;
  bus.on(Evt.CoinFly, (x: number, y: number, n: number) => {
    if (!target || !pill) return;
    const t = target.getBoundingClientRect();
    const tx = t.left + t.width / 2, ty = t.top + t.height / 2;
    for (let i = 0; i < n && live < MAX_LIVE; i++) {
      live++;
      const c = document.createElement('i');
      c.className = 'coin flycoin';
      document.body.appendChild(c);
      // espalha um pouco antes de subir, numa curva
      const sx = x + (Math.random() - 0.5) * 50, sy = y + (Math.random() - 0.5) * 30;
      const mx = sx + (tx - sx) * 0.35 + (Math.random() - 0.5) * 120, my = Math.min(sy, ty) - 60 - Math.random() * 60;
      const a = c.animate([
        { transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 30}px) scale(1.15)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${mx}px, ${my}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.6)`, opacity: 0.9 },
      ], { duration: 650 + Math.random() * 250, delay: i * 70, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
      a.onfinish = () => {
        c.remove();
        live--;
        pill.classList.remove('bump');
        void pill.offsetWidth;
        pill.classList.add('bump');
      };
    }
  });
}
