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
}

interface Strike {
  x: number;
  y: number;
  r: number;
  t: number;
  delay: number;
  hit: boolean;
  flash: number;
  onImpact: (x: number, y: number, r: number) => void;
}

const FLASH_TIME = 0.4;

/** Bolas de magia roxas com rastro. Todas desenhadas num único Graphics. */
export class Projectiles {
  private g: Phaser.GameObjects.Graphics;
  private list: Shot[] = [];
  private strikes: Strike[] = [];
  /** marcas no chão, por baixo dos personagens */
  private ground: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, private fx: Particles) {
    this.g = scene.add.graphics().setDepth(800_000);
    this.ground = scene.add.graphics().setDepth(-400_000);
  }

  /** Some com tudo que está no ar (cidade reerguida). */
  clear() {
    this.list = [];
    this.strikes = [];
    this.g.clear();
    this.ground.clear();
  }

  /** Raio sombrio: avisa no chão e, depois de `delay` segundos, cai com dano em área. */
  strike(x: number, y: number, r: number, delay: number, onImpact: (x: number, y: number, r: number) => void) {
    this.strikes.push({ x, y, r, t: 0, delay, hit: false, flash: 0, onImpact });
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
        gr.fillStyle(0x8a2be2, 0.12 + 0.2 * p).fillEllipse(s.x, s.y, s.r * 2, s.r);
        gr.lineStyle(3, 0xd070ff, 0.9).strokeEllipse(s.x, s.y, s.r * 2, s.r);
        gr.lineStyle(3, 0xf6dcff, 0.9).strokeEllipse(s.x, s.y, s.r * 2 * (1 - p * 0.8), s.r * (1 - p * 0.8));
        if (s.t >= s.delay) {
          s.hit = true;
          s.onImpact(s.x, s.y, s.r);
          sfx.strikeImpact();
          this.fx.burst(s.x, s.y, 26, 0xb04cff, true);
          this.fx.burst(s.x, s.y, 10, 0xf6dcff, true);
          this.scene.cameras.main.shake(110, 0.005);
        }
      } else {
        s.flash += dt;
        const k = 1 - s.flash / FLASH_TIME;
        if (k <= 0) { this.strikes.splice(i, 1); continue; }
        gr.fillStyle(0xb04cff, 0.35 * k).fillEllipse(s.x, s.y, s.r * 2 * (2 - k), s.r * (2 - k));
        // coluna de energia caindo do céu
        const w = s.r * 0.9 * k + 6;
        this.g.fillStyle(0x9b30ff, 0.55 * k).fillRect(s.x - w * 0.8, s.y - 520, w * 1.6, 520);
        this.g.fillStyle(0xf6dcff, 0.9 * k).fillRect(s.x - w * 0.35, s.y - 520, w * 0.7, 520);
      }
    }
  }

  fire(x: number, y: number, target: Combatant, aim: () => { x: number; y: number }, dmg: number, speed: number, size = 1) {
    this.list.push({ x, y, target, aim, dmg, speed, trail: [], sparkT: 0, age: 0, size });
    this.fx.burst(x, y, 6, 0xb04cff);
  }

  update(dt: number) {
    this.g.clear();
    this.updateStrikes(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.age += dt;
      const a = s.aim();
      const dx = a.x - s.x, dy = a.y - s.y, d = Math.hypot(dx, dy) || 1;
      const step = s.speed * dt;
      if (d <= step + 12 || s.age > 5) {
        if (s.target.alive) s.target.takeDamage(s.dmg, s.x, s.y);
        this.fx.burst(a.x, a.y, 12, 0xb04cff, true);
        sfx.magicHit();
        this.fx.burst(a.x, a.y, 5, 0xf0c8ff);
        this.list.splice(i, 1);
        continue;
      }
      s.x += dx / d * step;
      s.y += dy / d * step;
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 16) s.trail.shift();
      s.sparkT -= dt;
      if (s.sparkT <= 0) { s.sparkT = 0.04; this.fx.burst(s.x, s.y, 1, 0x9b30ff); }

      // rastro roxo que afina e some
      const n = s.trail.length;
      for (let k = 0; k < n; k++) {
        const t = (k + 1) / n;
        this.g.fillStyle(k % 2 ? 0xd070ff : 0x7a1fd1, t * 0.7).fillCircle(s.trail[k].x, s.trail[k].y, (2 + t * 7) * s.size);
      }
      this.g.fillStyle(0xb04cff, 0.3).fillCircle(s.x, s.y, 16 * s.size);
      this.g.fillStyle(0xd070ff, 1).fillCircle(s.x, s.y, 9 * s.size);
      this.g.fillStyle(0xf6dcff, 1).fillCircle(s.x - 2 * s.size, s.y - 2 * s.size, 4 * s.size);
    }
  }
}
