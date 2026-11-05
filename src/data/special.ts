/**
 * Soldados especiais: cabanas de tropas no nível 15 ou mais podem se transformar (com a Casa de Estudo de pé) numa casa
 * de soldados especiais: gigante, bombardeiro, quicador ou mago do gelo. Eles são bem mais fortes que os comuns e
 * cada um luta do seu jeito (veja COMBAT).
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

/** tamanho na tela (multiplica a altura do soldado) */
export const SPECIAL_SIZE: Record<SpecialKind, number> = { gigante: 2.6, bomba: 1.9, quicador: 2.0, gelo: 1.9 };

/** quantas vezes um especial é mais forte (vida e dano) que um soldado comum do mesmo nível */
export const SPECIAL_MIGHT: Record<SpecialKind, { hp: number; dmg: number }> = {
  gigante: { hp: 14, dmg: 9 },
  bomba: { hp: 5, dmg: 4 },
  quicador: { hp: 5, dmg: 4.5 },
  gelo: { hp: 5, dmg: 4 },
};

/** baú: chances de cair de cada orc, quanto tempo fica no chão (s) e o tamanho na tela (px) */
export const CHEST = { chance: 0.05, chanceElite: 0.3, life: 14, height: 74 };
export const chestCoins = (wave: number, boss: boolean) => Math.round((40 + wave * 14) * (boss ? 3 : 1));

/** nível mínimo da cabana para se transformar, custo em mana e quantos especiais a casa abriga em cada nível */
export const EVOLVE_LEVEL = 15;
export const EVOLVE_COST = 150;
export const specialCount = (level: number) => Math.min(4 + Math.floor(Math.max(0, level - 15) / 5), 8);

/**
 * Jeito de lutar de cada especial (fora o poder de arremesso):
 * - bombardeiro: cada ataque é uma bomba que explode em área, mas ele ataca devagar;
 * - gigante: dano absurdo, ataque pesado e resiste bem (recebe só uma parte do dano);
 * - mago do gelo: bolas de gelo de longe que machucam e congelam;
 * - quicador: desvia pulando (e os aliados perto dele pulam junto).
 */
export const COMBAT = {
  bombRadius: 105, bombCdMult: 2,
  giantArmor: 0.5, giantCdMult: 1.25, giantReach: 1.25,
  iceRange: 340, iceFreeze: 2.2, iceCdMin: 0.9,
  dodgeChance: 0.7, dodgeShare: 260, evadeSeconds: 0.55, dodgeHeight: 46,
};
