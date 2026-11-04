import Phaser from 'phaser';

/** Ponte entre a interface HTML (botões) e as cenas do Phaser. */
export const bus = new Phaser.Events.EventEmitter();

export const Evt = {
  /** UI -> jogo: clicou num botão da barra (id da cabana) */
  Build: 'build',
  /** jogo -> UI: modo de colocar cabana ligado/desligado */
  Placing: 'placing',
  Hint: 'hint',
  Coins: 'coins',
  /** jogo -> UI: mana atual e mana por segundo */
  Mana: 'mana',
  /** jogo -> UI: nível do Centro da Vila (libera a mana e os poderes) */
  Castle: 'castle',
  /** UI -> jogo: clicou num poder */
  Power: 'power',
  /** jogo -> UI: poder usado, com o tempo de espera em segundos */
  PowerCd: 'powerCd',
  /** jogo -> UI: preço atual de construir cada tipo (id -> moedas) */
  BuildCosts: 'buildCosts',
  /** jogo -> UI: número da onda atual */
  Wave: 'wave',
  /** jogo -> UI: moedas por segundo no total */
  Income: 'income',
  /** jogo -> UI: nível da espada do clique mudou */
  Sword: 'sword',
  /** UI -> jogo: clicou na carta de evoluir a espada */
  UpgradeSword: 'upgradeSword',
  /** jogo -> UI: onde (na tela) fica o botão de upgrade; muda quando a câmera anda */
  SelPos: 'selpos',
  /** jogo -> UI: cabana selecionada (SelectInfo) ou null */
  Select: 'select',
  /** UI -> jogo: clicou no botão verde de upgrade */
  Upgrade: 'upgrade',
  /** jogo -> UI: sem moedas para algo (id do botão) */
  Broke: 'broke',
  /** jogo -> UI: o castelo caiu */
  GameOver: 'gameover',
  /** UI -> jogo: o jogador quer reerguer a cidade */
  Rebuild: 'rebuild',
  /** UI -> jogo: o jogador assistiu a um anúncio e ganha moedas */
  Gift: 'gift',
  /** jogo -> UI: o que o jogador fez, para o tutorial: start, placed, wave, grab, throw, hit, upgrade */
  Tuto: 'tuto',
  /** jogo -> UI: faixa grande no meio da tela (onda, chefe, combo): { title, sub?, kind } */
  Banner: 'banner',
  /** UI -> jogo: pausou (true) ou voltou (false) pelo botão de pausa */
  Pause: 'pause',
  /** jogo -> UI: segundos até a próxima onda (null = sem contagem) */
  Countdown: 'countdown',
  /** jogo -> UI: estrelas reais (total, ganhas agora) */
  Stars: 'stars',
  /** meta -> jogo: uma melhoria da Forja foi comprada (id) */
  Perks: 'perks',
  /** UI -> UI: abrir a Forja Real */
  OpenForge: 'openForge',
} as const;

export interface BannerInfo { title: string; sub?: string; kind: 'wave' | 'boss' | 'combo' }

export interface SelectInfo {
  /** posição na tela do topo da cabana */
  x: number;
  y: number;
  /** próximo nível; null = já no máximo */
  next: { art: string; cost: number; /** custa mana em vez de moedas */ mana?: boolean; /** motivo de estar bloqueado (ex.: nível do centro da vila) */ lock?: string } | null;
}
