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

export const CASTLE_LEVELS: CastleLevel[] = [
  { cost: 0,    art: 'castelo',   width: 420, hp: 800,  minWave: 0,  income: 5,  hutMax: 1 },
  { cost: 1200, art: 'castelo_2', width: 440, hp: 1500, minWave: 4,  income: 12, hutMax: 2 },
  { cost: 5000, art: 'castelo_3', width: 480, hp: 2800, minWave: 10, income: 25, hutMax: 5 },
];
