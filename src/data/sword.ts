/** A espada do clique evolui até o nível 15. O visual só muda de tempos em tempos. */
export const SWORD_MAX = 15;

export interface SwordTier {
  /** a partir deste nível a espada usa este desenho */
  from: number;
  /** chave da imagem (também é o nome do arquivo em public/assets) */
  art: string;
  /** largura / altura do desenho */
  aspect: number;
  /** altura do cursor na tela (px) */
  height: number;
  /** onde fica a mão: fração da altura, contada a partir da ponta */
  pivot: number;
}

/**
 * Nível 1 a 4: espada simples. Nível 5 a 9: guarda dourada, maior. Nível 10 a 15: espada dourada com
 * lâmina brilhante, a maior. O desenho do nível 15 ainda pode ganhar um visual próprio (basta
 * acrescentar uma linha com `from: 15`).
 */
export const SWORD_TIERS: SwordTier[] = [
  { from: 1,  art: 'espada',   aspect: 148 / 320, height: 64, pivot: 0.78 },
  { from: 5,  art: 'espada_2', aspect: 212 / 380, height: 82, pivot: 0.74 },
  { from: 10, art: 'espada_3', aspect: 196 / 380, height: 102, pivot: 0.76 },
];

export function swordTier(level: number): SwordTier {
  let t = SWORD_TIERS[0];
  for (const x of SWORD_TIERS) if (level >= x.from) t = x;
  return t;
}

/** dano de cada clique */
export const swordDamage = (level: number) => 8 + (level - 1) * 3;
/** raio da área do clique (px do mapa): cresce a cada 5 níveis */
export const swordRadius = (level: number) => 60 + Math.floor((level - 1) / 5) * 12;
/** custo para ir deste nível ao próximo */
export const swordCost = (level: number) => Math.round(40 * Math.pow(1.38, level - 1) / 5) * 5;
