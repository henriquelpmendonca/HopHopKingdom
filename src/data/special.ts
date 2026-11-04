/**
 * Soldados especiais: cabanas de tropas no nível 15 ou mais podem se transformar (com a Casa de Estudo de pé) numa casa
 * de soldados especiais: gigante, bombardeiro, quicador ou mago do gelo. Eles são bem mais fortes que os comuns e
 * têm um poder que você libera arremessando: depois de usado, o soldado recarrega sozinho.
 */
export type SpecialKind = 'gigante' | 'bomba' | 'quicador' | 'gelo';

export const SPECIAL_KINDS: SpecialKind[] = ['gigante', 'bomba', 'quicador', 'gelo'];

/** desenho do soldado e da casa de cada especial */
export const SPECIAL_ART: Record<SpecialKind, string> = {
  gigante: 'soldado_gigante',
  bomba: 'soldado_bomba',
  quicador: 'soldado_quicador',
  gelo: 'soldado_gelo',
};
export const SPECIAL_HOUSE_ART: Record<SpecialKind, string> = {
  gigante: 'cabana_gigante_1',
  bomba: 'cabana_bomba_1',
  quicador: 'cabana_quicador_1',
  gelo: 'cabana_gelo_1',
};

/** tamanho na tela (multiplica a altura do soldado) e cor do brilho quando o poder está pronto */
export const SPECIAL_SIZE: Record<SpecialKind, number> = { gigante: 2.6, bomba: 1.9, quicador: 2.0, gelo: 1.9 };
export const SPECIAL_GLOW: Record<SpecialKind, number> = { gigante: 0xffd84a, bomba: 0xff8a2a, quicador: 0x4ac8ff, gelo: 0xa8e4ff };

/** quantas vezes um especial é mais forte (vida e dano) que um soldado comum do mesmo nível */
export const SPECIAL_MIGHT: Record<SpecialKind, { hp: number; dmg: number }> = {
  gigante: { hp: 7, dmg: 4.5 },
  bomba: { hp: 5, dmg: 4 },
  quicador: { hp: 5, dmg: 4.5 },
  gelo: { hp: 5, dmg: 4 },
};

/** dano da explosão da bomba: cresce com a onda, no mesmo ritmo dos inimigos */
export const bombDamage = (wave: number) => Math.round(120 * Math.pow(1.07, wave));
export const BOMB_RADIUS = 175;

/** gigante: por quantos segundos fica ainda maior e mais forte depois de pousar */
export const GIANT = { seconds: 12, hp: 2, dmg: 2, reach: 1.3, shockRadius: 140, shockMult: 0.5 };

/** quicador: quantos orcs atinge, a que distância pula de um para o outro e quanto cada pulo machuca */
export const BOUNCE = { jumps: 6, range: 360, mult: 0.45, step: 0.14 };

/** mago do gelo: área, tempo que os orcs ficam congelados (s) e o dano leve em fração da bomba */
export const FREEZE = { radius: 290, seconds: 3.2, mult: 0.25 };

/** baú: chances de cair de cada orc, quanto tempo fica no chão (s) e o tamanho na tela (px) */
export const CHEST = { chance: 0.05, chanceElite: 0.3, life: 14, height: 74 };
export const chestCoins = (wave: number, boss: boolean) => Math.round((40 + wave * 14) * (boss ? 3 : 1));

/** tempo (s) para a casa preparar outro poder depois de um ser usado; subir a casa deixa mais rápido */
export const rechargeSeconds = (level: number) => Math.max(8, Math.round(24 - level * 0.5));

/** nível mínimo da cabana para se transformar, custo em mana e quantos especiais a casa abriga em cada nível */
export const EVOLVE_LEVEL = 15;
export const EVOLVE_COST = 150;
export const specialCount = (level: number) => Math.min(4 + Math.floor(Math.max(0, level - 15) / 5), 8);
