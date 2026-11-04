import { bus, Evt, BannerInfo } from '../events';

/** Faixa grande no meio da tela: começo de onda, chefe e combos. O combo não atropela o aviso de onda. */
export function setupBanner() {
  const box = document.getElementById('banner') as HTMLElement;
  const title = document.getElementById('bannerT') as HTMLElement;
  const sub = document.getElementById('bannerS') as HTMLElement;
  let timer = 0;
  let bigUntil = 0;

  bus.on(Evt.Banner, (b: BannerInfo) => {
    const now = performance.now();
    if (b.kind === 'combo' && now < bigUntil) return;
    const ms = b.kind === 'boss' ? 2600 : b.kind === 'wave' ? 2000 : 1100;
    if (b.kind !== 'combo') bigUntil = now + ms;
    window.clearTimeout(timer);
    title.textContent = b.title;
    sub.textContent = b.sub ?? '';
    sub.hidden = !b.sub;
    box.className = b.kind;
    box.hidden = false;
    void box.offsetWidth;
    box.classList.add('show');
    timer = window.setTimeout(() => { box.hidden = true; }, ms);
  });
}
