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
} as const;

export interface SelectInfo {
  /** posição na tela do topo da cabana */
  x: number;
  y: number;
  /** próximo nível; null = já no máximo */
  next: { art: string; cost: number; /** motivo de estar bloqueado (ex.: nível do centro da vila) */ lock?: string } | null;
}
