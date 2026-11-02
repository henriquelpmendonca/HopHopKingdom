/** Poderes que o jogador ativa gastando mana. Liberados com o Centro da Vila nível 3. */
export interface PowerDef {
  id: 'meteoros' | 'congelar' | 'curar';
  nome: string;
  /** imagem em public/assets */
  art: string;
  /** mana gasta */
  cost: number;
  /** segundos até poder usar de novo */
  cd: number;
  desc: string;
}

export const POWERS: PowerDef[] = [
  { id: 'meteoros', nome: 'Chuva de Meteoros', art: 'poder_meteoros', cost: 50, cd: 22, desc: 'Meteoros caem sobre os inimigos mais perto da cidade' },
  { id: 'congelar', nome: 'Congelar', art: 'poder_congelar', cost: 35, cd: 28, desc: 'Congela todos os inimigos por 5 segundos' },
  { id: 'curar', nome: 'Cura', art: 'poder_curar', cost: 30, cd: 22, desc: 'Cura soldados e construções e levanta quem caiu' },
];

export const POWER_FREEZE_SECONDS = 5;
export const POWER_METEOR_COUNT = 6;
/** dano de cada meteoro: base + por onda */
export const meteorDamage = (wave: number) => 80 + wave * 10;
/** mana que o Centro da Vila nível 3 dá de presente, para comprar a primeira mina de mana */
export const MANA_GIFT = 120;
/** mana por segundo que o Centro da Vila nível 3 gera sozinho (para nunca ficar sem saída) */
export const CASTLE_MANA_INCOME = 1;
