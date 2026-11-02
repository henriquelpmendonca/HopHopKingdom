/** Qualquer coisa que pode apanhar: soldado, orc, castelo. */
export interface Combatant {
  x: number;
  y: number;
  hp: number;
  readonly alive: boolean;
  takeDamage(n: number, fromX: number, fromY: number): void;
}
