/** Cada tipo de soldado tem o seu desenho. Se o PNG ainda não existir, usa o soldado de espada. */
export type SoldierUnit = 'espada' | 'lanca' | 'alabarda';

export const UNIT_ART: Record<SoldierUnit, string> = {
  espada: 'soldado',
  lanca: 'soldado_lanca',
  alabarda: 'soldado_alabarda',
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
}

export interface HutDef {
  id: string;
  nome: string;
  levels: HutLevel[];
  /** quantas dá para ter ao mesmo tempo (sem limite se faltar) */
  maxCount?: number;
  /** cada construção a mais deste tipo custa mais: o preço é multiplicado por isto a cada uma que você já tem */
  costGrowth?: number;
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

function soldadoLevels(): HutLevel[] {
  return Array.from({ length: MAX_LEVEL }, (_, i) => {
    const lv = i + 1;
    const t = tierOf(SOLDADO_TIERS, lv) as Tier & { unit: SoldierUnit };
    return {
      cost: reach(50, 60, lv),
      art: t.art,
      hp: 150 + (lv - 1) * 45,
      // dentro do mesmo visual a cabana cresce um pouquinho a cada nível
      width: t.width + (lv - t.from) * 4,
      soldiers: [{ unit: t.unit, furia: lv >= MAX_LEVEL, count: Math.min(4 + lv, 16), power: 1 + 0.1 * (lv - 1) }],
    };
  });
}

export const CABANA_SOLDADO: HutDef = {
  id: 'cabana_soldado',
  nome: 'Cabana de Soldado',
  levels: soldadoLevels(),
};

/**
 * Mina de ouro: 15 níveis, a renda sobe a cada um. O visual do nível 10 ainda usa o do 5;
 * quando houver desenho novo, é só trocar a arte desse tier.
 */
const MINA_TIERS: Tier[] = [
  { from: 1,  art: 'mina_ouro_1', width: 190 },
  { from: 5,  art: 'mina_ouro_2', width: 215 },
  { from: 10, art: 'mina_ouro_2', width: 245 },
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

/** O que aparece na barra de construção. Novas construções entram aqui. */
export const BUILDABLES: HutDef[] = [CABANA_SOLDADO, MINA_OURO];

export function hutDef(id: string): HutDef {
  const d = BUILDABLES.find(b => b.id === id);
  if (!d) throw new Error('cabana desconhecida: ' + id);
  return d;
}
