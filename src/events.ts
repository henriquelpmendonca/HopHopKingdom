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
  /** jogo -> UI: o mouse está em cima de um inimigo (o cursor vira espada) */
  OverEnemy: 'overEnemy',
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
  /** jogo -> UI: missão atual { text, now, goal } ou missão concluída { done: true, reward } */
  Mission: 'mission',
  /** UI -> jogo: abrir o painel de status da casa selecionada */
  InfoOpen: 'infoOpen',
  /** UI -> jogo: fechar o painel de status */
  InfoClose: 'infoClose',
  /** jogo -> UI: dados do painel de status (HutInfo) ou null quando fecha */
  InfoData: 'infoData',
  /** jogo -> UI: comemoração no meio da tela, uma frase depois da outra */
  Celebrate: 'celebrate',
  /** jogo -> UI: moedinhas voando de um ponto da tela (x, y) até o contador: quantas */
  CoinFly: 'coinFly',
  /** UI -> jogo: chamar a próxima onda agora, levando as moedas da espera */
  CallWave: 'callWave',
  /** jogo <-> tutorial: start, placed, wave, grab, throw, hit, upgrade; step:<passo> e end vêm do tutorial */
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
  /** UI -> jogo: vender / mover a cabana selecionada */
  Sell: 'sell',
  /** UI -> jogo: evoluir a cabana selecionada para outra casa (id da casa nova) */
  Evolve: 'evolve',
  Move: 'move',
  /** jogo -> UI: barra de poder dos soldados especiais (0 a 100) */
  Charge: 'charge',
  /** UI -> UI: abrir a Forja Real */
  OpenForge: 'openForge',
} as const;

export interface BannerInfo { title: string; sub?: string; kind: 'wave' | 'boss' | 'combo' }

/** uma linha do painel de status: quanto vale agora, no próximo nível e no nível máximo */
export interface InfoRow {
  key: 'soldiers' | 'damage' | 'health' | 'rate' | 'hut_hp' | 'income' | 'mana';
  now: number;
  next: number | null;
  max: number;
  /** casas decimais ao mostrar */
  dec?: number;
}

export interface HutInfo {
  name: string;
  /** desenho da casa no nível atual */
  art: string;
  level: number;
  maxLevel: number;
  rows: InfoRow[];
  /** evoluir: custo e, se bloqueado, o motivo; null = já no máximo */
  next: { cost: number; mana: boolean; lock?: string } | null;
}

export interface SelectInfo {
  /** muda quando se seleciona outra construção (a roda de botões sai de novo do centro) */
  key: string;
  /** só cabanas: o botão dos três pontinhos abre o painel de status */
  info?: boolean;
  /** posição na tela do topo da cabana */
  x: number;
  y: number;
  /** próximo nível; null = já no máximo */
  next: { art: string; cost: number; /** custa mana em vez de moedas */ mana?: boolean; /** motivo de estar bloqueado (ex.: nível do centro da vila) */ lock?: string; /** escombros: o botão reconstrói */ repair?: boolean } | null;
  /** só cabanas: quanto devolve ao vender, quanto custa mover e se dá para fazer isso agora (entre ondas) */
  tools?: { refund: number; move: number; mana: boolean; ok: boolean };
  /** só cabanas que podem evoluir (com a Casa de Estudo de pé): as casas novas possíveis */
  evolve?: { id: string; art: string; name: string; cost: number; ok: boolean; lock?: string }[];
}
