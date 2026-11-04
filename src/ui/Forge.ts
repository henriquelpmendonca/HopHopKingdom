import { sfx } from '../audio';
import { t, type Key } from '../i18n';
import { bus, Evt } from '../events';
import { anyAffordable, buyPerk, canBuy, getStars, Perk, PERKS, perkCost, perkLevel } from '../meta';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** valor do bônus no nível dado, já como texto ("+16%" ou "+120") */
function bonusText(p: Perk, lv: number): string {
  return p.id === 'start' ? '+' + p.per * lv : '+' + Math.round(p.per * lv * 100) + '%';
}

/**
 * Forja Real: gasta as Estrelas Reais em melhorias que valem para sempre.
 * Abre pelo botão ⭐ do jogo ou pela tela de derrota; enquanto está aberta o jogo fica em pausa.
 */
export function setupForge() {
  const box = $('forge'), list = $('forgeList'), starsN = $('forgeStars'), btn = $('forgeBtn'), badge = $('forgeBadge');
  let open = false;
  let pausedByUs = false;

  const rows = new Map<string, { row: HTMLElement; lv: HTMLElement; eff: HTMLElement; buy: HTMLButtonElement }>();
  for (const p of PERKS) {
    const row = document.createElement('div');
    row.className = 'perk';
    row.innerHTML = `<span class="pi">${p.icon}</span><div class="pt"><b>${t(`perk.${p.id}` as Key)}</b><small>${t(`perk.${p.id}.desc` as Key)}</small><i class="pips"></i></div><div class="pe"></div>`;
    const buy = document.createElement('button');
    buy.className = 'pbuy';
    buy.addEventListener('click', () => {
      if (buyPerk(p.id)) { sfx.upgrade(true); row.classList.remove('bought'); void row.offsetWidth; row.classList.add('bought'); }
      else sfx.error();
    });
    row.appendChild(buy);
    list.appendChild(row);
    rows.set(p.id, { row, lv: row.querySelector('.pips') as HTMLElement, eff: row.querySelector('.pe') as HTMLElement, buy });
  }

  function paint() {
    starsN.textContent = String(getStars());
    for (const p of PERKS) {
      const r = rows.get(p.id)!;
      const lv = perkLevel(p.id);
      r.lv.innerHTML = Array.from({ length: p.max }, (_, i) => `<u class="${i < lv ? 'on' : ''}"></u>`).join('');
      const next = lv < p.max ? t('perk.next', { v: bonusText(p, lv + 1) }) : '';
      r.eff.innerHTML = `<b>${lv ? bonusText(p, lv) : '—'}</b><small>${next}</small>`;
      if (lv >= p.max) { r.buy.textContent = t('ui.max'); r.buy.disabled = true; r.buy.classList.remove('poor'); }
      else { r.buy.innerHTML = `⭐ ${perkCost(p)}`; r.buy.disabled = false; r.buy.classList.toggle('poor', !canBuy(p.id)); }
    }
    badge.textContent = String(getStars());
    btn.classList.toggle('ready', anyAffordable());
  }

  function show(on: boolean) {
    if (on === open) return;
    open = on;
    box.hidden = !on;
    btn.classList.toggle('open', on);
    if (on) paint();
    // o jogo fica parado enquanto a Forja está aberta (a pausa normal, se já estiver pausado, não é mexida)
    const paused = $('pause').hidden === false;
    if (on && !paused) { pausedByUs = true; bus.emit(Evt.Pause, true); }
    else if (!on && pausedByUs) { pausedByUs = false; bus.emit(Evt.Pause, false); }
  }

  btn.addEventListener('click', () => { sfx.ui(); show(!open); });
  $('forgeClose').addEventListener('click', () => { sfx.ui(); show(false); });
  bus.on(Evt.OpenForge, () => show(true));
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && open) show(false);
    else if (e.code === 'KeyF' && !e.repeat && $('over').hidden !== false) show(!open);
  });
  bus.on(Evt.Stars, () => { paint(); badge.classList.remove('pulse'); void badge.offsetWidth; badge.classList.add('pulse'); });
  bus.on(Evt.Perks, paint);
  paint();
}
