import { store } from './store';

/**
 * Missões curtas: sempre há um objetivo pequeno à vista, trocando a cada um ou dois minutos.
 * As primeiras ensinam o jogo (bater, arremessar, evoluir, construir); depois elas se repetem cada vez maiores.
 * A cena conta o que o jogador fez (`Stats`) e pergunta o progresso da missão atual.
 */
export type MissionKind = 'kills' | 'throws' | 'hutLevel' | 'huts' | 'wave' | 'chests' | 'sword';

export interface Mission { kind: MissionKind; goal: number; reward: number }

export interface Stats { kills: number; throws: number; chests: number; hutLevel: number; huts: number; wave: number; sword: number }

const FIRST: Mission[] = [
  { kind: 'kills', goal: 5, reward: 60 },
  { kind: 'throws', goal: 3, reward: 80 },
  { kind: 'hutLevel', goal: 3, reward: 100 },
  { kind: 'huts', goal: 3, reward: 120 },
  { kind: 'wave', goal: 5, reward: 150 },
  { kind: 'chests', goal: 1, reward: 150 },
  { kind: 'sword', goal: 3, reward: 200 },
  { kind: 'kills', goal: 40, reward: 250 },
  { kind: 'hutLevel', goal: 5, reward: 350 },
  { kind: 'huts', goal: 5, reward: 400 },
  { kind: 'wave', goal: 10, reward: 600 },
];

const KEY = 'hhk_mission';

/** missão número `i` (as primeiras são fixas; depois elas se repetem com metas maiores) */
export function missionAt(i: number, s: Stats): Mission {
  if (i < FIRST.length) return FIRST[i];
  const k = i - FIRST.length;
  const scale = 1 + Math.floor(k / 4) * 0.5;
  switch (k % 4) {
    case 0: return { kind: 'kills', goal: s.kills + Math.round(40 * scale), reward: Math.round(300 * scale) };
    case 1: return { kind: 'throws', goal: s.throws + Math.round(8 * scale), reward: Math.round(300 * scale) };
    case 2: return { kind: 'wave', goal: s.wave + 3, reward: Math.round(400 * scale) };
    default: return { kind: 'hutLevel', goal: Math.min(35, s.hutLevel + 2), reward: Math.round(450 * scale) };
  }
}

export function progressOf(m: Mission, s: Stats) { return Math.min(m.goal, s[m.kind]); }

export function loadMission(): { index: number; stats: { kills: number; throws: number; chests: number } } {
  try {
    const d = JSON.parse(store.get(KEY) ?? 'null');
    if (d && typeof d.index === 'number') return { index: d.index, stats: { kills: d.kills | 0, throws: d.throws | 0, chests: d.chests | 0 } };
  } catch { /* começa do zero */ }
  return { index: 0, stats: { kills: 0, throws: 0, chests: 0 } };
}

export function saveMission(index: number, s: { kills: number; throws: number; chests: number }) {
  store.set(KEY, JSON.stringify({ index, kills: s.kills, throws: s.throws, chests: s.chests }));
}

/**
 * Prêmio por voltar: na primeira visita de cada dia (a partir do segundo dia), moedas que crescem com a sequência de dias.
 * Devolve o prêmio de hoje (0 se já pegou ou se é o primeiro dia) e a sequência.
 */
export function dailyBonus(): { coins: number; streak: number } {
  const today = new Date().toISOString().slice(0, 10);
  let last = '', streak = 0;
  try { const d = JSON.parse(store.get('hhk_daily') ?? 'null'); if (d) { last = d.last; streak = d.streak | 0; } } catch { /* nada */ }
  if (last === today) return { coins: 0, streak };
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const first = !last;
  streak = last === yesterday ? streak + 1 : 1;
  store.set('hhk_daily', JSON.stringify({ last: today, streak }));
  if (first) return { coins: 0, streak };
  return { coins: 200 + 150 * Math.min(streak, 5), streak };
}
