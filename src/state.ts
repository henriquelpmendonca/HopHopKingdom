import { START_COINS } from './config';
import { bus, Evt } from './events';

/** Atalho de teste: ?moedas=2000 */
const qs = new URLSearchParams(location.search);

export const state = { coins: Number(qs.get('moedas')) || START_COINS, sword: Number(qs.get('espada')) || 1 };

export function addCoins(n: number) {
  state.coins += n;
  bus.emit(Evt.Coins, state.coins);
}

export function spend(n: number): boolean {
  if (state.coins < n) return false;
  addCoins(-n);
  return true;
}
