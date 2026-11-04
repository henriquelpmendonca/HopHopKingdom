/**
 * Soldados especiais: orcs derrotados enchem a barra de poder; com ela cheia, o próximo soldado que você
 * pega vira bombardeiro, gigante ou quicador. Depois do arremesso ele volta a ser um soldado comum.
 */
export type SpecialKind = 'bomba' | 'gigante' | 'quicador';

export const SPECIAL_KINDS: SpecialKind[] = ['bomba', 'gigante', 'quicador'];

export const SPECIAL_ART: Record<SpecialKind, string> = {
  bomba: 'soldado_bomba',
  gigante: 'soldado_gigante',
  quicador: 'soldado_quicador',
};

/** tamanho na tela (multiplica a altura do soldado) */
export const SPECIAL_SIZE: Record<SpecialKind, number> = { bomba: 1.9, gigante: 2.7, quicador: 2.0 };

export const POWER = {
  max: 100,
  /** por orc derrotado (o chefe vale muito mais) */
  perKill: 6,
  perBossKill: 40,
  /** por soldado comum que bate num orc ao ser arremessado */
  perThrowHit: 4,
};

/** dano da explosão da bomba: cresce com a onda, no mesmo ritmo dos inimigos */
export const bombDamage = (wave: number) => Math.round(120 * Math.pow(1.07, wave));
export const BOMB_RADIUS = 175;

/** gigante: por quantos segundos fica enorme e quanto ganha de vida e força */
export const GIANT = { seconds: 14, hp: 3.5, dmg: 3, reach: 1.5, shockRadius: 140, shockMult: 0.5 };

/** quicador: quantos orcs atinge, a que distância pula de um para o outro e quanto cada pulo machuca */
export const BOUNCE = { jumps: 6, range: 360, mult: 0.45, step: 0.14 };

/** baú: chances de cair de cada orc, quanto tempo fica no chão (s) e o tamanho na tela (px) */
export const CHEST = { chance: 0.05, chanceElite: 0.3, life: 14, height: 74 };
export const chestCoins = (wave: number, boss: boolean) => Math.round((40 + wave * 14) * (boss ? 3 : 1));
