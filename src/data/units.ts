import { SoldierUnit } from './cabanas';
import { waveGrowth } from './growth';

export interface UnitStats {
  hp: number;
  dmg: number;
  /** distância do corpo até o alvo para acertar (px) */
  reach: number;
  /** segundos entre ataques */
  cd: number;
  /** atira de longe: distância (px) a que ele para para atirar */
  range?: number;
  /** distância da cabana em que ele nota inimigos (px); padrão AGGRO_RANGE */
  aggro?: number;
  /** atira bolas de magia em vez de flechas */
  bolt?: boolean;
  /** feitiços que o mago lança em rodízio, um a cada ataque */
  spells?: Spell[];
}

/** bola de fogo (queima), gelo (congela) e raio (pula entre vários inimigos) */
export type Spell = 'fire' | 'ice' | 'lightning';

/** Detalhes dos feitiços dos magos aliados. */
export const SPELL = {
  /** a queimadura dá esta fração do dano por segundo... */
  burnDps: 0.28,
  /** ...durante estes segundos */
  burnSeconds: 4,
  freezeSeconds: 1.5,
  /** o raio pula para até tantos inimigos, a menos desta distância um do outro */
  chainJumps: 4,
  chainRange: 240,
  /** cada pulo do raio causa esta fração do dano anterior */
  chainFalloff: 0.82,
  /** tempo entre um pulo e o seguinte (s) */
  chainStep: 0.1,
};

export const UNIT_STATS: Record<SoldierUnit, UnitStats> = {
  espada:   { hp: 45,  dmg: 7,  reach: 30, cd: 0.9 },
  lanca:    { hp: 60,  dmg: 11, reach: 42, cd: 1.0 },
  alabarda: { hp: 100, dmg: 18, reach: 48, cd: 1.1 },
  // frágil, mas bate de longe e sem se machucar
  arqueiro: { hp: 38, dmg: 9, reach: 30, cd: 1.0, range: 300, aggro: 680 },
  arqueiro2: { hp: 55, dmg: 13, reach: 30, cd: 0.95, range: 330, aggro: 720 },
  arqueiro3: { hp: 80, dmg: 19, reach: 30, cd: 0.9, range: 360, aggro: 760 },
  // magos aliados: magia mais forte que a flecha, mas mais frágeis
  // 1-4: bola de fogo que queima; 5-9: fogo e gelo; 10-15: fogo, gelo e raio em cadeia
  magoA1: { hp: 42, dmg: 17, reach: 30, cd: 1.5, range: 290, aggro: 660, bolt: true, spells: ['fire'] },
  magoA2: { hp: 58, dmg: 26, reach: 30, cd: 1.4, range: 320, aggro: 700, bolt: true, spells: ['fire', 'ice'] },
  magoA3: { hp: 80, dmg: 38, reach: 30, cd: 1.3, range: 350, aggro: 740, bolt: true, spells: ['fire', 'ice', 'lightning'] },
};

/** Fúria: mais vida, golpes mais fortes e mais rápidos. */
export const FURIA = { hp: 1.3, dmg: 1.5, cd: 0.7, speed: 1.3 };

/** Distância da cabana em que os soldados notam inimigos (px). */
export const AGGRO_RANGE = 460;
/** Se se afastarem tanto da cabana, voltam. */
export const LEASH_RANGE = 600;
export const SOLDIER_RUN_SPEED = 170;
/** Segundos até um soldado morto reaparecer na cabana. */
export const RESPAWN_TIME = 7;

export const CASTLE_HP = 800;

export type OrcKind = 'orc1' | 'orc2' | 'orc3' | 'boss' | 'boss2' | 'mago' | 'mago2' | 'mago3' | 'esqueleto' | 'capitao' | 'dourado';

export interface OrcStats {
  /** chave da imagem carregada no BootScene */
  art: string;
  hp: number;
  dmg: number;
  reach: number;
  cd: number;
  speed: number;
  /** altura na tela (px) */
  height: number;
  coins: number;
  /** chefe: bate em área e esguicha mais sangue */
  boss?: boolean;
  /** chefinho (Capitão Orc): entra com faixa e deixa um baú, mas não conta como chefe de verdade */
  mini?: boolean;
  /** orc dourado: não ataca, atravessa a tela correndo e some; quem acertar ganha muitas moedas */
  runner?: boolean;
  /** invoca aliados de tempos em tempos (até `max` vivos de cada vez) */
  summon?: { kind: OrcKind; count: number; every: number; max: number };
  /** ataca de longe com projétil: alcance (px) e velocidade da bola (px/s) */
  ranged?: {
    range: number;
    projSpeed: number;
    size?: number;
    /** 'strike': marca o chão e, depois de um tempo, cai um raio sombrio em área */
    spell?: 'strike';
    radius?: number;
    delay?: number;
    /** cor do raio: azul-turquesa (Esqueleto Supremo) */
    tone?: 'teal';
  };
  /** raio (px) do golpe em área e fração do dano que os soldados em volta levam */
  aoe?: { radius: number; mult: number };
}

export const ORCS: Record<OrcKind, OrcStats> = {
  orc1: { art: 'orc',  hp: 110, dmg: 12, reach: 34, cd: 1.2, speed: 62, height: 76, coins: 12 },
  orc2: { art: 'orc2', hp: 260, dmg: 22, reach: 40, cd: 1.4, speed: 54, height: 96, coins: 30 },
  boss: { art: 'boss', hp: 2600, dmg: 85, reach: 70, cd: 1.9, speed: 38, height: 200, coins: 400, boss: true, aoe: { radius: 130, mult: 0.6 } },
  // Esqueleto Supremo: bem mais forte que o Rei Orc, devagar, invoca magos das trevas e solta raios azuis em salva
  boss2: {
    art: 'boss2', hp: 14400, dmg: 256, reach: 0, cd: 3.4, speed: 32, height: 240, coins: 1000, boss: true,
    ranged: { range: 440, projSpeed: 0, spell: 'strike', radius: 150, delay: 0.9, tone: 'teal' },
    summon: { kind: 'mago2', count: 2, every: 10, max: 5 },
  },
  mago: { art: 'mago', hp: 90, dmg: 20, reach: 0, cd: 2.0, speed: 56, height: 84, coins: 25, ranged: { range: 280, projSpeed: 400 } },
  mago2: { art: 'mago2', hp: 200, dmg: 40, reach: 0, cd: 2.8, speed: 52, height: 100, coins: 60, ranged: { range: 340, projSpeed: 0, spell: 'strike', radius: 100, delay: 1.0 } },
  mago3: { art: 'mago3', hp: 420, dmg: 44, reach: 0, cd: 3.2, speed: 48, height: 145, coins: 120, ranged: { range: 350, projSpeed: 0, spell: 'strike', radius: 100, delay: 1.0 }, summon: { kind: 'esqueleto', count: 2, every: 12, max: 3 } },
  esqueleto: { art: 'esqueleto', hp: 55, dmg: 9, reach: 30, cd: 1.0, speed: 88, height: 58, coins: 3 },
  // Capitão Orc: o primeiro grande desafio, na onda 5 (bem antes do Rei Orc, na 10)
  capitao: { art: 'chefinho', hp: 900, dmg: 30, reach: 52, cd: 1.5, speed: 46, height: 140, coins: 150, mini: true, aoe: { radius: 90, mult: 0.5 } },
  dourado: { art: 'orc_dourado', hp: 140, dmg: 0, reach: 0, cd: 99, speed: 150, height: 82, coins: 0, runner: true },
  orc3: { art: 'orc3', hp: 620, dmg: 38, reach: 46, cd: 1.6, speed: 48, height: 112, coins: 80 },
};

/** Quanto o inimigo fica mais forte a cada onda. */
/**
 * Ajuste fino da dificuldade: multiplica a vida dos inimigos e a quantidade por onda.
 * 0,9 na quantidade acompanha as casas mais caras e o raio de defesa maior (testado com um robô jogando 70 min:
 * cerca de 27 casas na onda 30, perto de uma derrota por partida, sempre em onda de chefe a partir da 23).
 */
export const ENEMY = { hpMult: 1, countMult: 0.9 };

export function orcForWave(kind: OrcKind, wave: number) {
  const o = ORCS[kind];
  return {
    // crescem em ritmo composto (8% e 4% por onda): sem isso a economia do jogador ultrapassa os inimigos
    // até a onda 30: 8% de vida e 4% de dano por onda; depois: 4,5% e 2% (veja data/growth.ts)
    hp: Math.round(o.hp * ENEMY.hpMult * waveGrowth(wave, 0.08, 0.045)),
    dmg: Math.round(o.dmg * waveGrowth(wave, 0.04, 0.02)),
    speed: Math.min(o.speed + wave * 1.5, o.speed + 30),
  };
}

/**
 * Sorteia o tipo de inimigo. Cada novo tipo demora a aparecer, para o jogador crescer entre um e outro:
 * orc 2 a partir da onda 4, orc 3 a partir da 8; depois do primeiro chefe vêm os magos:
 * mago 2 a partir da onda 16 e mago 3 (que invoca esqueletos) só a partir da 24.
 */
export function pickOrcKind(wave: number, magos = false): OrcKind {
  if (magos && Math.random() < Math.min(0.3, 0.15 + wave * 0.006)) {
    const c3 = Math.min(0.4, Math.max(0, (wave - 23) * 0.08));
    const c2 = Math.min(0.5, Math.max(0, (wave - 15) * 0.12));
    const r = Math.random();
    if (r < c3) return 'mago3';
    return r < c3 + c2 * (1 - c3) ? 'mago2' : 'mago';
  }
  const c3 = Math.min(0.4, Math.max(0, (wave - 7) * 0.08));
  const c2 = Math.min(0.65, Math.max(0, (wave - 3) * 0.15));
  const r = Math.random();
  if (r < c3) return 'orc3';
  if (r < c3 + c2 * (1 - c3)) return 'orc2';
  return 'orc1';
}

/** Em que onda aparece o primeiro chefe e, depois, a cada quantas ondas ele volta. */
export const BOSS_FIRST = 10;
export const BOSS_EVERY = 5;

export function isBossWave(wave: number) {
  return wave >= BOSS_FIRST && (wave - BOSS_FIRST) % BOSS_EVERY === 0;
}

/** A partir da onda 50, a cada 3 Reis Orc vem 1 Esqueleto Supremo no lugar do 4º (50, 70, 90...). */
export const BOSS2_FIRST = 50;
export function bossKindFor(wave: number): 'boss' | 'boss2' {
  return wave >= BOSS2_FIRST && ((wave - BOSS2_FIRST) / BOSS_EVERY) % 4 === 0 ? 'boss2' : 'boss';
}

export const WAVE = {
  /** segundos até a primeira onda: dá tempo de construir a primeira cabana */
  firstDelay: 30,
  /** segundos de preparação: a contagem só corre depois que o último inimigo da onda morreu */
  interval: 55,
  /** preparação depois da onda `wave`: curta no começo (sem ficar parado) e crescendo até `interval` */
  gap: (wave: number) => Math.min(55, 18 + wave * 6),
  /** se algum inimigo ficar preso e a onda durar mais que isto (s), a contagem corre mesmo assim */
  maxFight: 180,
  count: (wave: number) => Math.max(2, Math.min(Math.round((2 + Math.floor(wave * 0.9)) * ENEMY.countMult), 22)),
};
