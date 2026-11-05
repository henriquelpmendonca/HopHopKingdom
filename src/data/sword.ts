/** A espada do clique evolui até o nível 45. O visual só muda de tempos em tempos (1, 5, 10 e 20). */
export const SWORD_MAX = 45;

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
 * Nível 1 a 4: espada simples. Nível 5 a 9: guarda dourada, maior. Nível 10 a 19: espada dourada com
 * lâmina brilhante. Nível 20 a 45: a espada real, dourada e vermelha com a coroa, a maior de todas.
 */
export const SWORD_TIERS: SwordTier[] = [
  { from: 1,  art: 'espada',   aspect: 148 / 320, height: 64, pivot: 0.78 },
  { from: 5,  art: 'espada_2', aspect: 212 / 380, height: 82, pivot: 0.74 },
  { from: 10, art: 'espada_3', aspect: 196 / 380, height: 102, pivot: 0.76 },
  { from: 20, art: 'espada_4', aspect: 260 / 400, height: 124, pivot: 0.77 },
];

export function swordTier(level: number): SwordTier {
  let t = SWORD_TIERS[0];
  for (const x of SWORD_TIERS) if (level >= x.from) t = x;
  return t;
}

/** do nível 15 em diante o crescimento fica mais suave: o preço sobe 20% por nível */
const SWORD_KNEE = 15;
/** a espada real (nível 20 em diante) ganha um salto de dano e depois cresce mais rápido */
const SWORD_REAL = { from: 20, base: 130, growth: 1.12 };
/** dano de cada clique: +3 por nível até o 15; 9% por nível até o 19; e a espada real a partir do 20 */
export const swordDamage = (level: number) => {
  if (level <= SWORD_KNEE) return 8 + (level - 1) * 3;
  if (level < SWORD_REAL.from) return Math.round((8 + (SWORD_KNEE - 1) * 3) * Math.pow(1.09, level - SWORD_KNEE));
  return Math.round(SWORD_REAL.base * Math.pow(SWORD_REAL.growth, level - SWORD_REAL.from));
};
/** raio da área do clique (px do mapa): cresce a cada 5 níveis */
export const swordRadius = (level: number) => 60 + Math.floor((level - 1) / 5) * 12;
/** custo para ir deste nível ao próximo */
export const swordCost = (level: number) => level <= SWORD_KNEE
  ? Math.round(40 * Math.pow(1.38, level - 1) / 5) * 5
  : Math.round(40 * Math.pow(1.38, SWORD_KNEE - 1) * Math.pow(1.2, level - SWORD_KNEE) / 5) * 5;
