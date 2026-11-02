import Phaser from 'phaser';
import { sfx } from '../audio';
import { Particles } from '../fx';
import { Combatant } from './Combatant';

interface Shot {
  x: number;
  y: number;
  target: Combatant;
  /** onde mirar agora (o alvo pode estar andando) */
  aim: () => { x: number; y: number };
  dmg: number;
  speed: number;
  trail: { x: number; y: number }[];
  sparkT: number;
  age: number;
  size: number;
  /** magia roxa (magos) ou flecha (arqueiros) */
  style: 'magic' | 'arrow';
  /** cores da magia: roxa dos inimigos ou azul dos magos aliados */
  pal: Palette;
  /** o que acontece além do dano quando acerta (queimar, congelar...) */
  onHit?: (target: Combatant) => void;
}

interface Palette { trailA: number; trailB: number; glow: number; core: number; hi: number; spark: number }

export const PURPLE: Palette = { trailA: 0x7a1fd1, trailB: 0xd070ff, glow: 0xb04cff, core: 0xd070ff, hi: 0xf6dcff, spark: 0x9b30ff };
export const FIRE: Palette = { trailA: 0xd9410f, trailB: 0xffc04a, glow: 0xff7a1f, core: 0xffa030, hi: 0xfff0b0, spark: 0xff6a00 };
export const ICE: Palette = { trailA: 0x2a8fd8, trailB: 0xb8ecff, glow: 0x6ccaff, core: 0xbfefff, hi: 0xffffff, spark: 0x8fdcff };
export const BLUE: Palette = { trailA: 0x1f7ad1, trailB: 0x70c0ff, glow: 0x4aa8ff, core: 0x70c0ff, hi: 0xdcf0ff, spark: 0x309bff };

interface Strike {
  x: number;
  y: number;
  r: number;
  t: number;
  delay: number;
  hit: boolean;
  flash: number;
  onImpact: (x: number, y: number, r: number) => void;
  /** meteoro: cores de fogo em vez de roxo */
  fire: boolean;
}

const FLASH_TIME = 0.4;

/** Bolas de magia roxas com rastro. Todas desenhadas num único Graphics. */
export class Projectiles {
  private g: Phaser.GameObjects.Graphics;
  private list: Shot[] = [];
  private strikes: Strike[] = [];
  private bolts: { x1: number; y1: number; x2: number; y2: number; t0: number; age: number; target: Combatant; dmg: number; applied: boolean }[] = [];
  /** marcas no chão, por baixo dos personagens */
  private ground: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private fx: Particles) {
    this.g = scene.add.graphics().setDepth(800_000);
    this.ground = scene.add.graphics().setDepth(-400_000);
  }

  /**
   * Raio em cadeia: sai de (x, y), acerta o primeiro alvo e pula de um em um, em sequência.
   * `pts` já vem na ordem; cada pulo causa um pouco menos de dano.
   */
  chain(x: number, y: number, pts: { target: Combatant; x: number; y: number }[], dmg: number, falloff: number, step: number) {
    if (pts.length === 0) return;
    sfx.zap();
    let px = x, py = y, d = dmg;
    pts.forEach((p, i) => {
      this.bolts.push({ x1: px, y1: py, x2: p.x, y2: p.y, t0: i * step, age: 0, target: p.target, dmg: Math.max(1, Math.round(d)), applied: false });
      px = p.x;
      py = p.y;
      d *= falloff;
    });
  }

  private updateBolts(dt: number) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.age += dt;
      if (b.age < b.t0) continue;
      if (!b.applied) {
        b.applied = true;
        if (b.target.alive) b.target.takeDamage(b.dmg, b.x1, b.y1);
        this.fx.burst(b.x2, b.y2, 6, 0xfff6a0);
      }
      const life = b.age - b.t0;
      if (life > 0.26) { this.bolts.splice(i, 1); continue; }
      // raio em zigue-zague, desenhado de novo a cada quadro para tremer
      const k = 1 - life / 0.26;
      const dx = b.x2 - b.x1, dy = b.y2 - b.y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, n = Math.max(4, Math.round(len / 28));
      const pts: [number, number][] = [[b.x1, b.y1]];
      for (let j = 1; j < n; j++) {
        const t = j / n, off = (Math.random() - 0.5) * 22;
        pts.push([b.x1 + dx * t + nx * off, b.y1 + dy * t + ny * off]);
      }
      pts.push([b.x2, b.y2]);
      for (const [w, c, a] of [[7, 0x9fd0ff, 0.45 * k], [2.5, 0xffffff, 0.95 * k]] as [number, number, number][]) {
        this.g.lineStyle(w, c, a).beginPath().moveTo(pts[0][0], pts[0][1]);
        for (let j = 1; j < pts.length; j++) this.g.lineTo(pts[j][0], pts[j][1]);
        this.g.strokePath();
      }
    }
  }

  /** Some com tudo que está no ar (cidade reerguida). */
  clear() {
    this.list = [];
    this.strikes = [];
    this.bolts = [];
    this.g.clear();
    this.ground.clear();
  }

  /** Raio sombrio: avisa no chão e, depois de `delay` segundos, cai com dano em área. */
  strike(x: number, y: number, r: number, delay: number, onImpact: (x: number, y: number, r: number) => void, fire = false) {
    this.strikes.push({ x, y, r, t: 0, delay, hit: false, flash: 0, onImpact, fire });
  }

  private updateStrikes(dt: number) {
    const gr = this.ground;
    gr.clear();
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      if (!s.hit) {
        s.t += dt;
        const p = Math.min(1, s.t / s.delay);
        // aviso: círculo que enche e anel que fecha
        gr.fillStyle(s.fire ? 0xff5a1f : 0x8a2be2, 0.12 + 0.2 * p).fillEllipse(s.x, s.y, s.r * 2, s.r);
        gr.lineStyle(3, s.fire ? 0xffb347 : 0xd070ff, 0.9).strokeEllipse(s.x, s.y, s.r * 2, s.r);
        gr.lineStyle(3, 0xf6dcff, 0.9).strokeEllipse(s.x, s.y, s.r * 2 * (1 - p * 0.8), s.r * (1 - p * 0.8));
        if (s.t >= s.delay) {
          s.hit = true;
          s.onImpact(s.x, s.y, s.r);
          sfx.strikeImpact();
          this.fx.burst(s.x, s.y, 26, s.fire ? 0xff7a1f : 0xb04cff, true);
          this.fx.burst(s.x, s.y, 10, s.fire ? 0xfff0b0 : 0xf6dcff, true);
          this.scene.cameras.main.shake(110, 0.005);
        }
      } else {
        s.flash += dt;
        const k = 1 - s.flash / FLASH_TIME;
        if (k <= 0) { this.strikes.splice(i, 1); continue; }
        gr.fillStyle(s.fire ? 0xff7a1f : 0xb04cff, 0.35 * k).fillEllipse(s.x, s.y, s.r * 2 * (2 - k), s.r * (2 - k));
        // coluna de energia caindo do céu
        const w = s.r * 0.9 * k + 6;
        this.g.fillStyle(s.fire ? 0xff4a00 : 0x9b30ff, 0.55 * k).fillRect(s.x - w * 0.8, s.y - 520, w * 1.6, 520);
        this.g.fillStyle(s.fire ? 0xfff2c0 : 0xf6dcff, 0.9 * k).fillRect(s.x - w * 0.35, s.y - 520, w * 0.7, 520);
      }
    }
  }

  fire(x: number, y: number, target: Combatant, aim: () => { x: number; y: number }, dmg: number, speed: number, size = 1, style: 'magic' | 'arrow' = 'magic', pal: Palette = PURPLE, onHit?: (target: Combatant) => void) {
    this.list.push({ x, y, target, aim, dmg, speed, trail: [], sparkT: 0, age: 0, size, style, pal, onHit });
    if (style === 'arrow') sfx.arrow(); else this.fx.burst(x, y, 6, pal.glow);
  }

  update(dt: number) {
    this.g.clear();
    this.updateStrikes(dt);
    this.updateBolts(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.age += dt;
      const a = s.aim();
      const dx = a.x - s.x, dy = a.y - s.y, d = Math.hypot(dx, dy) || 1;
      const step = s.speed * dt;
      if (d <= step + 12 || s.age > 5) {
        if (s.target.alive) {
          s.target.takeDamage(s.dmg, s.x, s.y);
          s.onHit?.(s.target);
        }
        if (s.style === 'arrow') {
          this.fx.burst(a.x, a.y, 4, 0xe8d9b8);
        } else {
          this.fx.burst(a.x, a.y, 12, s.pal.glow, true);
          sfx.magicHit();
          this.fx.burst(a.x, a.y, 5, s.pal.hi);
        }
        this.list.splice(i, 1);
        continue;
      }
      s.x += dx / d * step;
      s.y += dy / d * step;
      if (s.style === 'arrow') {
        // flecha: haste marrom, ponta clara e pena atrás
        const ux = dx / d, uy = dy / d;
        this.g.lineStyle(3, 0x8a5a2b, 1).beginPath().moveTo(s.x - ux * 18, s.y - uy * 18).lineTo(s.x, s.y).strokePath();
        this.g.lineStyle(2, 0xf0e8d8, 1).beginPath().moveTo(s.x - ux * 18, s.y - uy * 18).lineTo(s.x - ux * 12 - uy * 4, s.y - uy * 12 + ux * 4).strokePath();
        this.g.fillStyle(0xd8d4cc, 1).fillTriangle(s.x + ux * 6, s.y + uy * 6, s.x - uy * 3, s.y + ux * 3, s.x + uy * 3, s.y - ux * 3);
        continue;
      }
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 16) s.trail.shift();
      s.sparkT -= dt;
      if (s.sparkT <= 0) { s.sparkT = 0.04; this.fx.burst(s.x, s.y, 1, s.pal.spark); }

      // rastro roxo que afina e some
      const n = s.trail.length;
      for (let k = 0; k < n; k++) {
        const t = (k + 1) / n;
        this.g.fillStyle(k % 2 ? s.pal.trailB : s.pal.trailA, t * 0.7).fillCircle(s.trail[k].x, s.trail[k].y, (2 + t * 7) * s.size);
      }
      this.g.fillStyle(s.pal.glow, 0.3).fillCircle(s.x, s.y, 16 * s.size);
      this.g.fillStyle(s.pal.core, 1).fillCircle(s.x, s.y, 9 * s.size);
      this.g.fillStyle(s.pal.hi, 1).fillCircle(s.x - 2 * s.size, s.y - 2 * s.size, 4 * s.size);
    }
  }
}
