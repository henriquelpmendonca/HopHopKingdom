import { store } from './store';

/** Salvamento do progresso. Usa o armazenamento do SDK do CrazyGames, ou o do navegador fora dele. */
const KEY = 'hophopkingdom_save';
const VERSION = 1;

export interface SavedHut {
  id: string;
  /** posição em relação à base do centro da vila (a tela muda de tamanho) */
  dx: number;
  dy: number;
  level: number;
}

export interface SaveData {
  v: number;
  coins: number;
  castleLevel: number;
  /** nível da espada do clique */
  sword?: number;
  /** mana guardada */
  mana?: number;
  /** última onda que começou */
  wave: number;
  /** o primeiro chefe já morreu (magos liberados) */
  magos: boolean;
  huts: SavedHut[];
}

export function loadGame(): SaveData | null {
  try {
    const raw = store.get(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (d.v !== VERSION || !Array.isArray(d.huts)) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveGame(d: Omit<SaveData, 'v'>) {
  try {
    store.set(KEY, JSON.stringify({ v: VERSION, ...d }));
  } catch {
    // sem espaço ou bloqueado: o jogo segue sem salvar
  }
}

export function clearSave() {
  try {
    store.remove(KEY);
  } catch {
    // ignora
  }
}
