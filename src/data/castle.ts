export interface CastleLevel {
  /** moedas para chegar a este nível */
  cost: number;
  /** chave da imagem carregada no BootScene */
  art: string;
  /** largura na tela (px) */
  width: number;
  hp: number;
  /** só dá para evoluir depois de chegar a esta onda */
  minWave: number;
  /** moedas por segundo (até as minas existirem) */
  income: number;
  /** maior nível de cabana que dá para construir/evoluir com este centro */
  hutMax: number;
}

/**
 * 5 níveis. Os dois primeiros visuais novos (vermelhos) são o crescimento normal da cidade.
 * Os dois últimos (roxos) são a cidade que começou a prosperar na magia: liberam a mana, a Cabana do Mago e
 * os poderes, e custam muito mais caro de conseguir.
 */
export const CASTLE_LEVELS: CastleLevel[] = [
  { cost: 0,     art: 'castelo',   width: 420, hp: 800,  minWave: 0,  income: 4,  hutMax: 5 },
  { cost: 1200,  art: 'castelo_2', width: 440, hp: 1500, minWave: 6,  income: 8, hutMax: 9 },
  { cost: 3500,  art: 'castelo_3', width: 470, hp: 2200, minWave: 15, income: 12, hutMax: 12 },
  // a partir daqui: magia (mana, Cabana do Mago e poderes)
  { cost: 14000, art: 'castelo_4', width: 480, hp: 3300, minWave: 28, income: 18, hutMax: 15 },
  { cost: 45000, art: 'castelo_5', width: 500, hp: 4800, minWave: 45, income: 26, hutMax: 25 },
  // o último: palácio real, libera as cabanas do nível 26 ao 35
  { cost: 120000, art: 'castelo_6', width: 520, hp: 6800, minWave: 65, income: 36, hutMax: 35 },
];

/** nível do Centro da Vila que libera a mana, a Cabana do Mago e os poderes */
export const MAGIC_CASTLE_LEVEL = 4;
