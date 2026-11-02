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
}

export interface HutDef {
  id: string;
  nome: string;
  levels: HutLevel[];
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

/** O que aparece na barra de construção. Novas cabanas entram aqui. */
export const BUILDABLES: HutDef[] = [CABANA_SOLDADO];

export function hutDef(id: string): HutDef {
  const d = BUILDABLES.find(b => b.id === id);
  if (!d) throw new Error('cabana desconhecida: ' + id);
  return d;
}
