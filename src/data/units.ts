import { SoldierUnit } from './cabanas';

export interface UnitStats {
  hp: number;
  dmg: number;
  /** distância do corpo até o alvo para acertar (px) */
  reach: number;
  /** segundos entre ataques */
  cd: number;
}

export const UNIT_STATS: Record<SoldierUnit, UnitStats> = {
  espada:   { hp: 45,  dmg: 7,  reach: 30, cd: 0.9 },
  lanca:    { hp: 60,  dmg: 11, reach: 42, cd: 1.0 },
  alabarda: { hp: 100, dmg: 18, reach: 48, cd: 1.1 },
};

/** Fúria: mais vida, golpes mais fortes e mais rápidos. */
export const FURIA = { hp: 1.3, dmg: 1.5, cd: 0.7, speed: 1.3 };

/** Distância da cabana em que os soldados notam inimigos (px). */
export const AGGRO_RANGE = 340;
/** Se se afastarem tanto da cabana, voltam. */
export const LEASH_RANGE = 460;
export const SOLDIER_RUN_SPEED = 170;
/** Segundos até um soldado morto reaparecer na cabana. */
export const RESPAWN_TIME = 7;

export const CASTLE_HP = 800;

export type OrcKind = 'orc1' | 'orc2' | 'orc3' | 'boss' | 'mago' | 'mago2' | 'mago3' | 'esqueleto';

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
  };
  /** raio (px) do golpe em área e fração do dano que os soldados em volta levam */
  aoe?: { radius: number; mult: number };
}

export const ORCS: Record<OrcKind, OrcStats> = {
  orc1: { art: 'orc',  hp: 110, dmg: 12, reach: 34, cd: 1.2, speed: 62, height: 76, coins: 12 },
  orc2: { art: 'orc2', hp: 260, dmg: 22, reach: 40, cd: 1.4, speed: 54, height: 96, coins: 30 },
  boss: { art: 'boss', hp: 2600, dmg: 85, reach: 70, cd: 1.9, speed: 38, height: 200, coins: 400, boss: true, aoe: { radius: 130, mult: 0.6 } },
  mago: { art: 'mago', hp: 90, dmg: 20, reach: 0, cd: 2.0, speed: 56, height: 84, coins: 25, ranged: { range: 280, projSpeed: 400 } },
  mago2: { art: 'mago2', hp: 200, dmg: 40, reach: 0, cd: 2.8, speed: 52, height: 100, coins: 60, ranged: { range: 340, projSpeed: 0, spell: 'strike', radius: 100, delay: 1.0 } },
  mago3: { art: 'mago3', hp: 420, dmg: 44, reach: 0, cd: 3.2, speed: 48, height: 145, coins: 120, ranged: { range: 350, projSpeed: 0, spell: 'strike', radius: 100, delay: 1.0 }, summon: { kind: 'esqueleto', count: 2, every: 12, max: 3 } },
  esqueleto: { art: 'esqueleto', hp: 55, dmg: 9, reach: 30, cd: 1.0, speed: 88, height: 58, coins: 3 },
  orc3: { art: 'orc3', hp: 620, dmg: 38, reach: 46, cd: 1.6, speed: 48, height: 112, coins: 80 },
};

/** Quanto o inimigo fica mais forte a cada onda. */
export function orcForWave(kind: OrcKind, wave: number) {
  const o = ORCS[kind];
  return {
    hp: Math.round(o.hp * (1 + 0.09 * wave)),
    dmg: Math.round(o.dmg * (1 + 0.05 * wave)),
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

export const WAVE = {
  /** segundos até a primeira onda: dá tempo de construir a primeira cabana */
  firstDelay: 30,
  /** segundos entre uma onda e outra: mais tempo para construir e evoluir */
  interval: 38,
  count: (wave: number) => Math.min(2 + Math.floor(wave * 0.75), 14),
};
