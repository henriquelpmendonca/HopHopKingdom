import { MAGIC_CASTLE_LEVEL } from './castle';
import { rechargeSeconds, SPECIAL_HOUSE_ART, specialCount, type SpecialKind } from './special';

/** Cada tipo de soldado tem o seu desenho. Se o PNG ainda não existir, usa o soldado de espada. */
export type SoldierUnit = 'espada' | 'lanca' | 'alabarda' | 'arqueiro' | 'arqueiro2' | 'arqueiro3' | 'magoA1' | 'magoA2' | 'magoA3';

export const UNIT_ART: Record<SoldierUnit, string> = {
  espada: 'soldado',
  lanca: 'soldado_lanca',
  alabarda: 'soldado_alabarda',
  arqueiro: 'arqueiro',
  arqueiro2: 'arqueiro_2',
  arqueiro3: 'arqueiro_3',
  magoA1: 'mago_aliado_1',
  magoA2: 'mago_aliado_2',
  magoA3: 'mago_aliado_3',
};

export interface SoldierSpec {
  unit: SoldierUnit;
  /** aura vermelha e mais rápido */
  furia?: boolean;
  count: number;
  /** multiplicador de vida e dano: cada nível da cabana deixa os soldados um pouco mais fortes */
  power?: number;
  /** soldado especial de uma casa evoluída: fica brilhando até ser arremessado e depois leva um tempo para recarregar */
  special?: SpecialKind;
  /** segundos para recarregar o poder */
  recharge?: number;
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
  /** até que nível dá para evoluir, conforme o nível do Centro da Vila (padrão: o limite do próprio centro) */
  maxLevelByCastle?: (castleLevel: number) => number;
}

/** Preço de construir mais uma deste tipo, sabendo quantas você já tem. */
export function buildCost(def: HutDef, owned: number) {
  return Math.round(def.levels[0].cost * Math.pow(def.costGrowth ?? 1, owned) / 5) * 5;
}

/** Quantos níveis têm as cabanas e as minas. O visual muda de 5 em 5 níveis (1-4, 5-9, 10-14, 15...). Só o Centro da Vila nível 5 libera do 16 ao 25. */
export const MAX_LEVEL = 35;
/** a partir deste nível os soldados entram em fúria */
const FURIA_LEVEL = 15;

/** Um visual de construção: vale a partir do nível `from`. */
interface Tier { from: number; art: string; width: number }

/** O tier de um nível: o último cujo `from` já foi alcançado. */
function tierOf(tiers: Tier[], level: number) {
  let t = tiers[0];
  for (const x of tiers) if (level >= x.from) t = x;
  return t;
}

/** Preço de chegar ao nível `lv` (1 = construir; 2 em diante = evoluir), subindo 30% por nível. */
const reach = (first: number, step: number, lv: number) => {
  if (lv === 1) return first;
  const at15 = step * Math.pow(1.3, 15 - 2);
  // depois do nível 15 o preço sobe mais devagar (22% por nível), senão ficaria impossível
  return Math.round((lv <= 15 ? step * Math.pow(1.3, lv - 2) : at15 * Math.pow(1.22, lv - 15)) / 5) * 5;
};

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
      // o tamanho só muda quando o visual muda (5, 10): dentro do mesmo visual a cabana não cresce
      width: t.width,
      soldiers: [{ unit: t.unit, furia: lv >= FURIA_LEVEL, count: Math.min(o.countBase + lv, o.countCap), power: 1 + 0.1 * (lv - 1) }],
    };
  });
}

export const CABANA_SOLDADO: HutDef = {
  id: 'cabana_soldado',
  nome: 'Cabana de Soldado',
  // cada cabana a mais custa 15% mais: um exército gigante não sai de graça
  costGrowth: 1.15,
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
  costGrowth: 1.15,
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
      width: t.width,
      soldiers: [],
      income: Math.round(5 + (lv - 1) * 1.4),
    };
  });
}

export const MINA_OURO: HutDef = {
  id: 'mina_ouro',
  nome: 'Mina de Ouro',
  // sem limite de minas: cada uma custa 22% mais que a anterior, então o dinheiro não foge do controle
  costGrowth: 1.22,
  levels: minaLevels(),
};

/**
 * Cabana do Mago: só se compra com mana (Centro da Vila nível 4). Os magos aliados atiram bolas de magia azuis
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
  needCastle: MAGIC_CASTLE_LEVEL,
  // o terceiro visual (grão-mago, do nível 10 em diante) só com o Centro da Vila nível 5
  maxLevelByCastle: lv => (lv >= 5 ? MAX_LEVEL : 9),
  costGrowth: 1.15,
  levels: troopLevels(MAGO_TIERS, { first: 90, step: 60, hp0: 170, countBase: 2, countCap: 10 }),
};

/**
 * Mina de mana: só aparece com o Centro da Vila nível 4 e custa mana (o nível 4 já dá um pouco de mana
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
      width: t.width,
      soldiers: [],
      mana: Math.round((1.5 + (lv - 1) * 0.6) * 10) / 10,
    };
  });
}

export const MINA_MANA: HutDef = {
  id: 'mina_mana',
  nome: 'Mina de Mana',
  currency: 'mana',
  needCastle: MAGIC_CASTLE_LEVEL,
  costGrowth: 1.15,
  levels: manaLevels(),
};

/**
 * Casa de Estudo: onde se estudam novos guerreiros. Só com o Centro da Vila nível 4 (mana), e só uma.
 * Com ela de pé, cabanas de nível 10 ou mais podem evoluir (pagando mana) para casas de soldados especiais.
 */
export const CASA_ESTUDO: HutDef = {
  id: 'casa_estudo',
  nome: 'Casa de Estudo',
  currency: 'mana',
  needCastle: MAGIC_CASTLE_LEVEL,
  maxCount: 1,
  levels: [{ cost: 80, art: 'cabana_estudo_1', hp: 300, width: 160, soldiers: [] }],
};

/**
 * Casas especiais: qualquer cabana de tropas (soldado, arqueiro ou mago) no nível 15 ou mais pode se transformar
 * numa casa de soldados especiais, à escolha do jogador. Mantém posição e nível e continua subindo; as tropas comuns
 * dão lugar a especiais bem mais fortes, com poder de arremesso que recarrega sozinho. O último visual da cabana.
 */
export const EVOLVABLE = ['cabana_soldado', 'cabana_arqueiro', 'cabana_mago'];

const evolvedCache = new Map<string, HutDef>();

export const evolvedId = (kind: SpecialKind, baseId: string) => `esp:${kind}:${baseId}`;

/** A casa especial de um tipo, feita a partir de uma cabana de tropas (o desenho é o mesmo em todos os níveis). */
export function evolvedDef(kind: SpecialKind, base: HutDef): HutDef {
  const id = evolvedId(kind, base.id);
  const hit = evolvedCache.get(id);
  if (hit) return hit;
  const def: HutDef = {
    id,
    nome: base.nome,
    costGrowth: base.costGrowth,
    currency: base.currency,
    needCastle: base.needCastle,
    maxLevelByCastle: base.maxLevelByCastle,
    levels: base.levels.map((l, i) => {
      const b = l.soldiers[0];
      return {
        ...l,
        art: SPECIAL_HOUSE_ART[kind],
        // a casa especial é o último visual: mesmo tamanho em todos os níveis (o do nível 15 da cabana de origem)
        width: base.levels[14].width,
        soldiers: [{
          unit: b.unit,
          furia: true,
          special: kind,
          recharge: rechargeSeconds(i + 1),
          count: specialCount(i + 1),
          power: b.power,
        }],
      };
    }),
  };
  evolvedCache.set(id, def);
  return def;
}

/** O que aparece na barra de construção. Novas construções entram aqui. */
export const BUILDABLES: HutDef[] = [CABANA_SOLDADO, CABANA_ARQUEIRO, MINA_OURO, MINA_MANA, CABANA_MAGO, CASA_ESTUDO];

/** ids antigos de casas evoluídas (de versões anteriores) */
const LEGACY: Record<string, [SpecialKind, string]> = {
  cabana_gigante: ['gigante', 'cabana_soldado'],
  cabana_bomba: ['bomba', 'cabana_arqueiro'],
  cabana_quicador: ['quicador', 'cabana_arqueiro'],
};

export function hutDef(id: string): HutDef {
  const d = BUILDABLES.find(b => b.id === id);
  if (d) return d;
  // casa especial: "esp:<tipo>:<cabana de origem>" (ou um id antigo)
  const parts = id.startsWith('esp:') ? id.split(':').slice(1) : LEGACY[id];
  if (parts && parts.length === 2) {
    const base = BUILDABLES.find(b => b.id === parts[1]);
    if (base) return evolvedDef(parts[0] as SpecialKind, base);
  }
  throw new Error('cabana desconhecida: ' + id);
}
