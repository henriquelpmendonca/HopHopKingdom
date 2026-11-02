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

export const CABANA_SOLDADO: HutDef = {
  id: 'cabana_soldado',
  nome: 'Cabana de Soldado',
  levels: [
    { cost: 50,   art: 'cabana_soldado_1', hp: 150, width: 150, soldiers: [{ unit: 'espada', count: 5 }] },
    { cost: 150,  art: 'cabana_soldado_2', hp: 260, width: 175, soldiers: [{ unit: 'lanca', count: 10 }] },
    { cost: 400,  art: 'cabana_soldado_3', hp: 420, width: 260, soldiers: [{ unit: 'alabarda', count: 5 }, { unit: 'lanca', count: 5 }] },
    { cost: 900,  art: 'cabana_soldado_3', hp: 600, width: 275, soldiers: [{ unit: 'alabarda', count: 10 }] },
    { cost: 1800, art: 'cabana_soldado_3', hp: 850, width: 290, soldiers: [{ unit: 'alabarda', furia: true, count: 10 }] },
  ],
};

export const MINA_OURO: HutDef = {
  id: 'mina_ouro',
  nome: 'Mina de Ouro',
  // sem limite de minas: cada uma custa 12% mais que a anterior, então o dinheiro não foge do controle
  costGrowth: 1.12,
  levels: [
    { cost: 100, art: 'mina_ouro_1', hp: 260, width: 190, soldiers: [], income: 6 },
    { cost: 250, art: 'mina_ouro_2', hp: 450, width: 215, soldiers: [], income: 14 },
  ],
};

/** O que aparece na barra de construção. Novas construções entram aqui. */
export const BUILDABLES: HutDef[] = [CABANA_SOLDADO, MINA_OURO];

export function hutDef(id: string): HutDef {
  const d = BUILDABLES.find(b => b.id === id);
  if (!d) throw new Error('cabana desconhecida: ' + id);
  return d;
}
