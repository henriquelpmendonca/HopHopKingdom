/** Cada tipo de soldado tem o seu desenho. Se o PNG ainda não existir, usa o soldado de espada. */
export type SoldierUnit = 'espada' | 'lanca' | 'alabarda' | 'arqueiro' | 'arqueiro2' | 'arqueiro3' | 'magoA1' | 'magoA2' | 'magoA3';

export const UNIT_ART: Record<SoldierUnit, string> = {
  espada: 'soldado',
  lanca: 'soldado_lanca',
  alabarda: 'soldado_alabarda',
  arqueiro: 'arqueiro',
  arqueiro2: 'arqueiro_2',
  arqueiro3: 'arqueiro_3',
  // enquanto não há desenhos dos magos aliados, usam os dos magos inimigos pintados de azul
  magoA1: 'mago',
  magoA2: 'mago2',
  magoA3: 'mago3',
};

export interface SoldierSpec {
  unit: SoldierUnit;
  /** aura vermelha e mais rápido */
  furia?: boolean;
  count: number;
  /** multiplicador de vida e dano: cada nível da cabana deixa os soldados um pouco mais fortes */
  power?: number;
}

export interface HutLevel {
  /** moedas para construir (nível 1) ou para chegar a este nível */
  cost: number;
  /** chave da imagem carregada no BootScene */
  art: string;
  /** vida da cabana neste nível */
  hp: number;
  /** largura da cabana na tela (px) */
  width: number;
  /** soldados que moram nela neste nível */
  soldiers: SoldierSpec[];
  /** moedas por segundo que ela rende (minas) */
  income?: number;
  /** mana por segundo que ela rende (minas de mana) */
  mana?: number;
}

export interface HutDef {
  id: string;
  nome: string;
  levels: HutLevel[];
  /** quantas dá para ter ao mesmo tempo (sem limite se faltar) */
  maxCount?: number;
  /** cada construção a mais deste tipo custa mais: o preço é multiplicado por isto a cada uma que você já tem */
  costGrowth?: number;
  /** se for 'mana', construir e evoluir custa mana em vez de moedas */
  currency?: 'mana';
  /** só aparece na barra depois que o Centro da Vila chega a este nível */
  needCastle?: number;
}

/** Preço de construir mais uma deste tipo, sabendo quantas você já tem. */
export function buildCost(def: HutDef, owned: number) {
  return Math.round(def.levels[0].cost * Math.pow(def.costGrowth ?? 1, owned) / 5) * 5;
}

/** Quantos níveis têm as cabanas e as minas. O visual muda de 5 em 5 níveis (1-4, 5-9, 10-14, 15). */
export const MAX_LEVEL = 15;

/** Um visual de construção: vale a partir do nível `from`. */
interface Tier { from: number; art: string; width: number }

/** O tier de um nível: o último cujo `from` já foi alcançado. */
function tierOf(tiers: Tier[], level: number) {
  let t = tiers[0];
  for (const x of tiers) if (level >= x.from) t = x;
  return t;
}

/** Preço de chegar ao nível `lv` (1 = construir; 2 em diante = evoluir), subindo 30% por nível. */
const reach = (first: number, step: number, lv: number) =>
  lv === 1 ? first : Math.round(step * Math.pow(1.3, lv - 2) / 5) * 5;

/**
 * Cabana de soldado: 15 níveis. A decoração dos soldados muda junto com a cabana:
 * espada (1-4), lança (5-9), alabarda (10-14) e alabarda em fúria (15).
 * Cada nível também traz mais soldados e deixa todos um pouco mais fortes.
 */
const SOLDADO_TIERS: (Tier & { unit: SoldierUnit })[] = [
  { from: 1,  art: 'cabana_soldado_1', width: 150, unit: 'espada' },
  { from: 5,  art: 'cabana_soldado_2', width: 185, unit: 'lanca' },
  { from: 10, art: 'cabana_soldado_3', width: 270, unit: 'alabarda' },
];

/** Gera os 15 níveis de uma cabana que abriga soldados. */
function troopLevels(tiers: (Tier & { unit: SoldierUnit })[], o: { first: number; step: number; hp0: number; countBase: number; countCap: number }): HutLevel[] {
  return Array.from({ length: MAX_LEVEL }, (_, i) => {
    const lv = i + 1;
    const t = tierOf(tiers, lv) as Tier & { unit: SoldierUnit };
    return {
      cost: reach(o.first, o.step, lv),
      art: t.art,
      hp: o.hp0 + (lv - 1) * 45,
      // dentro do mesmo visual a cabana cresce um pouquinho a cada nível
      width: t.width + (lv - t.from) * 4,
      soldiers: [{ unit: t.unit, furia: lv >= MAX_LEVEL, count: Math.min(o.countBase + lv, o.countCap), power: 1 + 0.1 * (lv - 1) }],
    };
  });
}

export const CABANA_SOLDADO: HutDef = {
  id: 'cabana_soldado',
  nome: 'Cabana de Soldado',
  levels: troopLevels(SOLDADO_TIERS, { first: 50, step: 60, hp0: 150, countBase: 4, countCap: 16 }),
};

/**
 * Cabana de arqueiros: 15 níveis. Os arqueiros atiram de longe, então ficam atrás dos soldados.
 * Níveis 1-4: arqueiro simples; 5-9: armadura dourada; 10-14: armadura com esmeraldas; 15: o mesmo, em fúria. Um visual próprio para o 15 entra aqui quando estiver pronto.
 */
const ARQUEIRO_TIERS: (Tier & { unit: SoldierUnit })[] = [
  { from: 1,  art: 'cabana_arqueiro_1', width: 150, unit: 'arqueiro' },
  { from: 5,  art: 'cabana_arqueiro_2', width: 215, unit: 'arqueiro2' },
  { from: 10, art: 'cabana_arqueiro_3', width: 285, unit: 'arqueiro3' },
];

export const CABANA_ARQUEIRO: HutDef = {
  id: 'cabana_arqueiro',
  nome: 'Cabana de Arqueiros',
  levels: troopLevels(ARQUEIRO_TIERS, { first: 90, step: 70, hp0: 120, countBase: 3, countCap: 12 }),
};

/**
 * Mina de ouro: 15 níveis, a renda sobe a cada um. O visual muda no 5 e no 10;
 * um desenho próprio para o nível 15 entra aqui quando estiver pronto.
 */
const MINA_TIERS: Tier[] = [
  { from: 1,  art: 'mina_ouro_1', width: 190 },
  { from: 5,  art: 'mina_ouro_2', width: 215 },
  { from: 10, art: 'mina_ouro_3', width: 265 },
];

function minaLevels(): HutLevel[] {
  return Array.from({ length: MAX_LEVEL }, (_, i) => {
    const lv = i + 1;
    const t = tierOf(MINA_TIERS, lv);
    return {
      cost: reach(100, 80, lv),
      art: t.art,
      hp: 260 + (lv - 1) * 45,
      width: t.width + (lv - t.from) * 3,
      soldiers: [],
      income: Math.round(6 + (lv - 1) * 2.2),
    };
  });
}

export const MINA_OURO: HutDef = {
  id: 'mina_ouro',
  nome: 'Mina de Ouro',
  // sem limite de minas: cada uma custa 12% mais que a anterior, então o dinheiro não foge do controle
  costGrowth: 1.12,
  levels: minaLevels(),
};

/**
 * Cabana do Mago: só se compra com mana (Centro da Vila nível 3). Os magos aliados atiram bolas de magia azuis
 * de longe: 1-4 mago simples, 5-9 mago de armadura, 10-14 grão-mago. O 15 é o mesmo, em fúria.
 */
const MAGO_TIERS: (Tier & { unit: SoldierUnit })[] = [
  { from: 1,  art: 'cabana_mago_1', width: 150, unit: 'magoA1' },
  { from: 5,  art: 'cabana_mago_2', width: 175, unit: 'magoA2' },
  { from: 10, art: 'cabana_mago_3', width: 205, unit: 'magoA3' },
];

export const CABANA_MAGO: HutDef = {
  id: 'cabana_mago',
  nome: 'Cabana do Mago',
  currency: 'mana',
  needCastle: 3,
  costGrowth: 1.15,
  levels: troopLevels(MAGO_TIERS, { first: 90, step: 60, hp0: 170, countBase: 2, countCap: 10 }),
};

/**
 * Mina de mana: só aparece com o Centro da Vila nível 3 e custa mana (o nível 3 já dá um pouco de mana
 * para comprar a primeira). Rende mana por segundo, que paga os poderes. Só há o desenho do nível 1;
 * o visual muda no 5 e no 10.
 */
const MANA_TIERS: Tier[] = [
  { from: 1,  art: 'mina_mana_1', width: 190 },
  { from: 5,  art: 'mina_mana_2', width: 215 },
  { from: 10, art: 'mina_mana_3', width: 265 },
];

function manaLevels(): HutLevel[] {
  return Array.from({ length: MAX_LEVEL }, (_, i) => {
    const lv = i + 1;
    const t = tierOf(MANA_TIERS, lv);
    return {
      cost: reach(60, 45, lv),
      art: t.art,
      hp: 240 + (lv - 1) * 40,
      width: t.width + (lv - t.from) * 3,
      soldiers: [],
      mana: Math.round((1.5 + (lv - 1) * 0.6) * 10) / 10,
    };
  });
}

export const MINA_MANA: HutDef = {
  id: 'mina_mana',
  nome: 'Mina de Mana',
  currency: 'mana',
  needCastle: 3,
  costGrowth: 1.15,
  levels: manaLevels(),
};

/** O que aparece na barra de construção. Novas construções entram aqui. */
export const BUILDABLES: HutDef[] = [CABANA_SOLDADO, CABANA_ARQUEIRO, MINA_OURO, MINA_MANA, CABANA_MAGO];

export function hutDef(id: string): HutDef {
  const d = BUILDABLES.find(b => b.id === id);
  if (!d) throw new Error('cabana desconhecida: ' + id);
  return d;
}
