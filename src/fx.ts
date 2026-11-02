import Phaser from 'phaser';

interface Splat { x: number; y: number; life: number; blobs: { dx: number; dy: number; r: number }[]; color: number }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; r: number; color: number }

/** Texto que sobe e some (ex.: "+4"). */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffd84a') {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '22px', fontStyle: 'bold',
    color, stroke: '#5a3418', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(1_000_001).setScale(0.3);
  scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 350, duration: 650, onComplete: () => t.destroy() });
}

/** Poeirinha e brilhos desenhados num único Graphics. */
export class Particles {
  private g: Phaser.GameObjects.Graphics;
  private list: Particle[] = [];
  /** manchas de sangue no chão, por baixo de todo mundo */
  private ground: Phaser.GameObjects.Graphics;
  private splats: Splat[] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(1_000_000);
    this.ground = scene.add.graphics().setDepth(-500_000);
  }

  /** Esguicho de sangue no ar + mancha no chão. power: ~3 (arranhão) até ~90 (chefe morrendo). */
  blood(x: number, y: number, groundY: number, power: number) {
    const reds = [0xb3121a, 0x8c0d14, 0xd1202a, 0x6e0a10];
    const n = Math.min(70, Math.round(power * 1.4) + 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (80 + Math.random() * 220) * (0.6 + power / 40);
      this.list.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 120 - power * 3,
        life: 0.45 + Math.random() * 0.55, r: 2 + Math.random() * (2 + power / 14),
        color: reds[Math.floor(Math.random() * reds.length)],
      });
    }
    const clusters = 1 + Math.floor(power / 9);
    for (let c = 0; c < clusters; c++) {
      const spread = 14 + power * 1.4;
      const sx = x + (Math.random() - 0.5) * spread * 2;
      const sy = groundY + (Math.random() - 0.3) * spread * 0.6;
      const blobs = Array.from({ length: 4 + Math.floor(Math.random() * 4) }, () => ({
        dx: (Math.random() - 0.5) * (10 + power * 0.8),
        dy: (Math.random() - 0.5) * (5 + power * 0.4),
        r: 2 + Math.random() * (3 + power / 10),
      }));
      this.splats.push({ x: sx, y: sy, life: 28, blobs, color: reds[Math.floor(Math.random() * 3)] });
    }
    if (this.splats.length > 160) this.splats.splice(0, this.splats.length - 160);
  }

  burst(x: number, y: number, n: number, color: number, big = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (big ? 200 : 120) * (0.4 + Math.random());
      this.list.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40,
        life: 0.6 + Math.random() * 0.4, r: (big ? 9 : 5) * (0.6 + Math.random()), color,
      });
    }
  }

  update(dt: number) {
    this.ground.clear();
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i];
      s.life -= dt;
      if (s.life <= 0) { this.splats.splice(i, 1); continue; }
      this.ground.fillStyle(s.color, Math.min(0.85, s.life / 8));
      for (const b of s.blobs) this.ground.fillEllipse(s.x + b.dx, s.y + b.dy, b.r * 2.2, b.r * 1.2);
    }
    this.g.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
      this.g.fillStyle(p.color, Math.min(1, p.life * 1.4));
      this.g.fillCircle(p.x, p.y, p.r);
    }
  }
}

/** Número de dano que pula da cabeça de quem apanhou. */
export function popDamage(scene: Phaser.Scene, x: number, y: number, n: number, onHero: boolean) {
  const big = Math.min(2.6, 1 + n / 35);
  const t = scene.add.text(x + (Math.random() - 0.5) * 24, y, String(n), {
    fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '22px', fontStyle: '900',
    color: onHero ? '#ff5a4d' : '#ffffff', stroke: onHero ? '#4a0d08' : '#7a1409', strokeThickness: 6,
  }).setOrigin(0.5).setDepth(1_000_002).setScale(0.2);
  const dx = (Math.random() - 0.5) * 50;
  scene.tweens.add({ targets: t, scale: big * 1.4, duration: 110, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, scale: big, delay: 110, duration: 120 });
  scene.tweens.add({ targets: t, x: t.x + dx, y: y - 44, duration: 700, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, delay: 450, duration: 350, onComplete: () => t.destroy() });
}

/** Barras de vida de todo mundo, redesenhadas a cada quadro num único Graphics. */
export class Bars {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(999_000);
  }

  begin() { this.g.clear(); }

  draw(x: number, y: number, ratio: number, width: number, color: number) {
    const h = 7, left = x - width / 2;
    this.g.fillStyle(0x3d230f, 1).fillRoundedRect(left - 2, y - 2, width + 4, h + 4, 4);
    this.g.fillStyle(0x7a2a1a, 1).fillRoundedRect(left, y, width, h, 3);
    if (ratio > 0) this.g.fillStyle(color, 1).fillRoundedRect(left, y, Math.max(4, width * ratio), h, 3);
  }
}
