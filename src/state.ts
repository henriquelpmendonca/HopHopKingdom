import { START_COINS } from './config';
import { bus, Evt } from './events';

/** Atalho de teste: ?moedas=2000 */
const qs = new URLSearchParams(import.meta.env.DEV ? location.search : '');

export const state = {
  coins: Number(qs.get('moedas')) || START_COINS,
  sword: Number(qs.get('espada')) || 1,
  /** segunda moeda: paga as minas de mana e os poderes */
  mana: Number(qs.get('mana')) || 0,
};

/** o tutorial dos primeiros minutos está rodando */
export const tuto = {
  on: false,
  /** passo atual: hit, throw, upgrade ou build */
  step: '',
  /** este passo precisa de inimigos na tela: se acabarem, a cena manda mais */
  foes: false,
  /** onde a mão do tutorial aponta na tela; com bx e by, ela arrasta de um ponto ao outro */
  aim: null as { ax: number; ay: number; bx?: number; by?: number } | null,
};

export function addCoins(n: number) {
  state.coins += n;
  bus.emit(Evt.Coins, state.coins);
}

export function spend(n: number): boolean {
  if (state.coins < n) return false;
  addCoins(-n);
  return true;
}

export function addMana(n: number) {
  state.mana = Math.max(0, state.mana + n);
}

export function spendMana(n: number): boolean {
  if (state.mana < n) return false;
  state.mana -= n;
  return true;
}
