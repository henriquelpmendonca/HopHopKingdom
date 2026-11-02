/** Qualquer construção no mapa. (x, y) é o centro da base, no chão. */
export interface Building {
  x: number;
  y: number;
  /** largura / altura na tela */
  w: number;
  h: number;
}

/** Construção que os inimigos podem atacar. */
export interface Structure extends Building {
  hp: number;
  readonly alive: boolean;
  takeDamage(n: number, fromX: number, fromY: number): void;
  /** ponto da construção mais próximo de (px, py), onde os inimigos batem */
  nearestPoint(px: number, py: number): { x: number; y: number };
}

/** Retângulo ocupado no chão, para não deixar construir uma por cima da outra. */
export function footprint(b: Building) {
  return { l: b.x - b.w * 0.45, r: b.x + b.w * 0.45, t: b.y - b.h * 0.7, b: b.y + 6 };
}

export function overlaps(a: Building, b: Building, margin = 12) {
  const A = footprint(a), B = footprint(b);
  return A.l < B.r + margin && A.r > B.l - margin && A.t < B.b + margin && A.b > B.t - margin;
}
