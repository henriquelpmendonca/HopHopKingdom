/**
 * Salvamento do progresso. Hoje usa o localStorage do navegador.
 * Quando o SDK do CrazyGames entrar, é só trocar as três funções abaixo
 * pelo armazenamento de dados deles; o resto do jogo não muda.
 */
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
  /** última onda que começou */
  wave: number;
  /** o primeiro chefe já morreu (magos liberados) */
  magos: boolean;
  huts: SavedHut[];
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
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
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...d }));
  } catch {
    // sem espaço ou bloqueado: o jogo segue sem salvar
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}
