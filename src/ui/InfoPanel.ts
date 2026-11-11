import { sfx } from '../audio';
import { markUiPointer } from '../camera';
import { bus, Evt, type HutInfo, type InfoRow } from '../events';
import { t, type Key } from '../i18n';

/**
 * Painel de status de uma casa: abre ao lado dela (a câmera aproxima a casa para o lado esquerdo) e mostra, para cada número,
 * quanto vale agora, quanto vai valer no próximo nível (parte listrada da barra) e até onde dá para chegar (fim da barra).
 * O botão de evoluir fica aqui dentro e o painel se atualiza sozinho quando a casa sobe de nível.
 */
const COIN = '<i class="coin"></i>';
const GEM = '<i class="gem"></i>';
const ICON: Partial<Record<InfoRow['key'], string>> = { soldiers: 'st_soldados', damage: 'st_dano', health: 'st_vida', rate: 'st_vel', income: 'st_renda' };

const fmt = (v: number, dec = 0) => dec ? v.toFixed(dec) : v >= 100000 ? Math.round(v / 1000) + 'k' : v >= 10000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v));

export function setupInfoPanel() {
  const box = document.createElement('div');
  box.id = 'info';
  box.hidden = true;
  box.innerHTML = '<button id="infoX" aria-label="close">✕</button>'
    + '<div class="ihead"><img class="iart" alt=""><div><h2 class="iname"></h2><span class="ilv"></span></div></div>'
    + '<div class="ilvbar"><img src="assets/st_nivel.png" alt=""><i><u></u></i></div>'
    + '<div id="irows"></div><button id="iup"></button>';
  document.body.appendChild(box);
  box.addEventListener('pointerdown', markUiPointer);

  const q = <T extends HTMLElement>(s: string) => box.querySelector(s) as T;
  const rows = q('#irows'), up = q<HTMLButtonElement>('#iup'), art = q<HTMLImageElement>('.iart');
  let coins = 0, mana = 0;
  let data: HutInfo | null = null;
  /** largura anterior de cada barra: ao subir de nível a barra cresce em vez de aparecer pronta */
  const prev = new Map<string, [number, number]>();
  let shownFor = '';

  const paintButton = () => {
    const d = data;
    if (!d) return;
    if (!d.next) { up.className = 'maxed'; up.textContent = t('info.maxed'); return; }
    if (d.next.lock) { up.className = 'locked'; up.innerHTML = `🔒 ${d.next.lock}`; return; }
    const poor = (d.next.mana ? mana : coins) < d.next.cost;
    up.className = poor ? 'poor' : '';
    up.innerHTML = `<span>⬆ ${t('info.upgrade')}</span><span class="c">${d.next.mana ? GEM : COIN}${d.next.cost}</span>`;
  };

  const render = (d: HutInfo) => {
    const fresh = shownFor !== d.name + ':' + d.art.split('_')[0];
    if (fresh) { prev.clear(); }
    shownFor = d.name + ':' + d.art.split('_')[0];
    art.src = `assets/${d.art}.png`;
    q('.iname').textContent = d.name;
    q('.ilv').textContent = t('info.level', { n: d.level, m: d.maxLevel });
    (q('.ilvbar u') as HTMLElement).style.width = Math.round(d.level / d.maxLevel * 100) + '%';
    rows.innerHTML = d.rows.map(r => {
      const icon = r.key === 'mana' ? GEM : r.key === 'hut_hp' ? `<img src="assets/${d.art}.png" alt="">` : `<img src="assets/${ICON[r.key]}.png" alt="">`;
      const gain = r.next !== null && r.next > r.now ? `<em>+${fmt(r.next - r.now, r.dec ?? 0)}</em>` : '';
      return `<div class="irow" data-k="${r.key}">${icon}<div class="imid"><div class="itop"><span>${t(`info.${r.key}` as Key)}</span><b class="ival">${fmt(r.now, r.dec ?? 0)}${gain}</b></div>`
        + `<div class="ibar"><u class="nx"></u><u class="now"></u></div><small class="imax">${t('info.max')} ${fmt(r.max, r.dec ?? 0)}</small></div></div>`;
    }).join('');
    void rows.offsetWidth;
    for (const r of d.rows) {
      const el = rows.querySelector(`[data-k="${r.key}"]`) as HTMLElement;
      const now = Math.min(100, r.now / r.max * 100), nx = Math.min(100, (r.next ?? r.now) / r.max * 100);
      const [p0, p1] = prev.get(r.key) ?? [0, 0];
      const a = el.querySelector('.now') as HTMLElement, b = el.querySelector('.nx') as HTMLElement;
      a.style.width = p0 + '%'; b.style.width = p1 + '%';
      void a.offsetWidth;
      requestAnimationFrame(() => { a.style.width = now + '%'; b.style.width = nx + '%'; });
      prev.set(r.key, [now, nx]);
    }
    paintButton();
  };

  const open = (d: HutInfo) => {
    const was = box.hidden;
    data = d;
    box.hidden = false;
    document.body.classList.add('info');
    if (was) { box.classList.remove('in'); void box.offsetWidth; box.classList.add('in'); sfx.ui(); }
    render(d);
  };
  const close = () => {
    if (box.hidden) return;
    box.hidden = true;
    data = null;
    shownFor = '';
    document.body.classList.remove('info');
  };

  bus.on(Evt.InfoData, (d: HutInfo | null) => { if (d) open(d); else close(); });
  bus.on(Evt.Coins, (n: number) => { coins = n; paintButton(); });
  bus.on(Evt.Mana, (n: number) => { mana = n; paintButton(); });
  bus.on(Evt.Broke, (id: string) => {
    if (id !== 'upgrade' || box.hidden) return;
    up.classList.remove('shake'); void up.offsetWidth; up.classList.add('shake');
  });

  q('#infoX').addEventListener('click', () => { sfx.ui(); bus.emit(Evt.InfoClose); });
  up.addEventListener('click', () => {
    if (!data?.next || data.next.lock) { sfx.error(); return; }
    sfx.ui();
    bus.emit(Evt.Upgrade);
  });
  window.addEventListener('keydown', e => { if (e.code === 'Escape' && !box.hidden) bus.emit(Evt.InfoClose); });
}
