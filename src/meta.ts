import { bus, Evt } from './events';
import { store } from './store';

/**
 * Progressão que fica para sempre: as Estrelas Reais.
 * Ganha-se jogando (derrotando orcs, batendo o recorde de onda e vencendo o Rei Orc) e gasta-se na Forja Real
 * em melhorias que valem em qualquer cidade, mesmo depois de recomeçar do zero.
 */
export type PerkId = 'treasure' | 'strong' | 'wall' | 'sword' | 'start';

export interface Perk {
  id: PerkId;
  icon: string;
  /** níveis máximos */
  max: number;
  /** estrelas do primeiro nível; o nível seguinte custa mais (base, 2×base, 3×base...) */
  base: number;
  /** bônus por nível: fração (+8%) ou, em `start`, moedas */
  per: number;
}

export const PERKS: Perk[] = [
  { id: 'treasure', icon: '💰', max: 5, base: 6, per: 0.08 },
  { id: 'strong', icon: '🛡️', max: 5, base: 8, per: 0.06 },
  { id: 'wall', icon: '🏰', max: 5, base: 6, per: 0.08 },
  { id: 'sword', icon: '⚔️', max: 5, base: 8, per: 0.08 },
  { id: 'start', icon: '🏠', max: 5, base: 5, per: 60 },
];

/** quantos orcs derrotados valem uma estrela */
export const KILLS_PER_STAR = 10;
export const STARS_RECORD_WAVE = 2;
export const STARS_RECORD_BOSS_WAVE = 5;
export const STARS_BOSS_KILL = 3;

const K_STARS = 'hhk_stars';
const K_PERKS = 'hhk_perks';
const K_KILLS = 'hhk_killacc';

let stars = 0;
let killAcc = 0;
let levels: Record<string, number> = {};
let loaded = false;

/** lê só na primeira vez que precisa: o armazenamento do SDK só existe depois de sdk.init() */
function load() {
  if (loaded) return;
  loaded = true;
  stars = Number(store.get(K_STARS)) || 0;
  killAcc = Number(store.get(K_KILLS)) || 0;
  try { levels = JSON.parse(store.get(K_PERKS) ?? '{}') as Record<string, number>; } catch { levels = {}; }
}

/** com atalhos de teste na barra de endereço, nada disto é lido nem gravado */
let enabled = true;
export function setMetaEnabled(on: boolean) { enabled = on; if (on) load(); }

export const getStars = () => { load(); return stars; };
export const perkLevel = (id: PerkId) => { load(); return levels[id] ?? 0; };
export const perkCost = (p: Perk) => p.base * (perkLevel(p.id) + 1);

/** multiplicador (1 + bônus) de uma melhoria percentual */
export function perkMult(id: PerkId): number {
  const p = PERKS.find(x => x.id === id)!;
  return 1 + p.per * perkLevel(id);
}

/** moedas extras ao começar uma cidade nova */
export function startBonus(): number {
  const p = PERKS.find(x => x.id === 'start')!;
  return p.per * perkLevel('start');
}

function save() {
  if (!enabled) return;
  store.set(K_STARS, String(stars));
  store.set(K_PERKS, JSON.stringify(levels));
  store.set(K_KILLS, String(killAcc));
}

export function addStars(n: number) {
  if (!enabled || n <= 0) return;
  load();
  stars += n;
  save();
  bus.emit(Evt.Stars, stars, n);
}

/** conta um orc derrotado; a cada KILLS_PER_STAR vem uma estrela. Devolve as estrelas ganhas agora. */
export function noteKill(): number {
  if (!enabled) return 0;
  load();
  killAcc++;
  if (killAcc < KILLS_PER_STAR) { if (killAcc % 5 === 0) save(); return 0; }
  killAcc = 0;
  addStars(1);
  return 1;
}

export function canBuy(id: PerkId): boolean {
  const p = PERKS.find(x => x.id === id)!;
  return perkLevel(id) < p.max && getStars() >= perkCost(p);
}

/** compra o próximo nível de uma melhoria; devolve se deu certo */
export function buyPerk(id: PerkId): boolean {
  load();
  if (!enabled || !canBuy(id)) return false;
  const p = PERKS.find(x => x.id === id)!;
  stars -= perkCost(p);
  levels[id] = perkLevel(id) + 1;
  save();
  bus.emit(Evt.Stars, stars, 0);
  bus.emit(Evt.Perks, id);
  return true;
}

/** alguma melhoria dá para comprar agora? (a Forja pisca) */
export function anyAffordable(): boolean {
  return PERKS.some(p => canBuy(p.id));
}
