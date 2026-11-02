import Phaser from 'phaser';
import { DIGIT_CELL, DigitSet } from './textures';

/* ---------- números que sobem ---------- */

let activeNumbers = 0;
/** no máximo isto de números ao mesmo tempo: em lutas enormes o excesso só atrapalha o desempenho */
const MAX_NUMBERS = 26;

/** Um número feito de imagens (uma por dígito), bem mais leve que um texto. */
function digitObject(scene: Phaser.Scene, str: string, set: DigitSet, x: number, y: number) {
  const { advance } = DIGIT_CELL;
  const total = (str.length - 1) * advance;
  const c = scene.add.container(x, y);
  [...str].forEach((ch, i) => c.add(scene.add.image(i * advance - total / 2, 0, set, ch)));
  return c;
}

/** Texto que sobe e some (ex.: "+4"). Números usam imagens; palavras, texto de verdade. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = '#ffd84a') {
  if (/^\+\d+$/.test(text)) {
    if (activeNumbers >= MAX_NUMBERS) return;
    activeNumbers++;
    const c = digitObject(scene, text, 'dg_gold', x, y).setDepth(1_000_001).setScale(0.3);
    scene.tweens.add({ targets: c, scale: 0.8, duration: 180, ease: 'Back.easeOut' });
    scene.tweens.add({
      targets: c, y: y - 50, alpha: 0, delay: 350, duration: 650,
      onComplete: () => { activeNumbers--; c.destroy(); },
    });
    return;
  }
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '22px', fontStyle: 'bold',
    color, stroke: '#5a3418', strokeThickness: 5,
  }).setOrigin(0.5).setDepth(1_000_001).setScale(0.3);
  scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 350, duration: 650, onComplete: () => t.destroy() });
}

/** Número de dano que pula da cabeça de quem apanhou. */
export function popDamage(scene: Phaser.Scene, x: number, y: number, n: number, onHero: boolean) {
  if (activeNumbers >= MAX_NUMBERS) return;
  activeNumbers++;
  const big = Math.min(2.2, 0.75 + n / 60);
  const c = digitObject(scene, String(n), onHero ? 'dg_red' : 'dg_white', x + (Math.random() - 0.5) * 24, y)
    .setDepth(1_000_002).setScale(0.2);
  const dx = (Math.random() - 0.5) * 50;
  scene.tweens.add({ targets: c, scale: big, duration: 200, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: c, x: c.x + dx, y: y - 44, alpha: { value: 0, ease: 'Cubic.easeIn' }, duration: 750, ease: 'Quad.easeOut',
    onComplete: () => { activeNumbers--; c.destroy(); },
  });
}

/* ---------- partículas e sangue ---------- */

interface Particle { img: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; life: number }
interface Splat { img: Phaser.GameObjects.Image; life: number }

const MAX_PARTICLES = 320;
const MAX_SPLATS = 90;

/** Poeirinha, brilhos e sangue. Tudo imagens reaproveitadas, nada é redesenhado a cada quadro. */
export class Particles {
  private pool: Phaser.GameObjects.Image[] = [];
  private list: Particle[] = [];
  private splats: Splat[] = [];

  constructor(private scene: Phaser.Scene) {}

  private take() {
    return this.pool.pop() ?? this.scene.add.image(0, 0, 'dot').setDepth(1_000_000);
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, r: number, color: number) {
    if (this.list.length >= MAX_PARTICLES) return;
    const img = this.take().setVisible(true).setAlpha(1).setTint(color).setScale(r / 4).setPosition(x, y);
    this.list.push({ img, x, y, vx, vy, life });
  }

  /** Esguicho de sangue no ar + mancha no chão. power: ~3 (arranhão) até ~90 (chefe morrendo). */
  blood(x: number, y: number, groundY: number, power: number) {
    const reds = [0xb3121a, 0x8c0d14, 0xd1202a, 0x6e0a10];
    const n = Math.min(40, Math.round(power * 0.9) + 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (80 + Math.random() * 220) * (0.6 + power / 40);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 120 - power * 3,
        0.45 + Math.random() * 0.55, 2 + Math.random() * (2 + power / 14), reds[Math.floor(Math.random() * reds.length)]);
    }
    // manchas no chão: uma imagem por mancha, no máximo MAX_SPLATS
    const clusters = Math.min(4, 1 + Math.floor(power / 14));
    for (let c = 0; c < clusters; c++) {
      const spread = 14 + power * 1.2;
      const img = this.scene.add.image(
        x + (Math.random() - 0.5) * spread * 2, groundY + (Math.random() - 0.3) * spread * 0.6, 'blood' + Math.floor(Math.random() * 3))
        .setDepth(-500_000).setTint(reds[Math.floor(Math.random() * 3)]).setAlpha(0.85)
        .setScale(0.35 + power / 90 + Math.random() * 0.2).setAngle(Math.random() * 360);
      this.splats.push({ img, life: 26 });
      if (this.splats.length > MAX_SPLATS) this.splats.shift()!.img.destroy();
    }
  }

  burst(x: number, y: number, n: number, color: number, big = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (big ? 200 : 120) * (0.4 + Math.random());
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 40, 0.6 + Math.random() * 0.4,
        (big ? 9 : 5) * (0.6 + Math.random()), color);
    }
  }

  update(dt: number) {
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i];
      s.life -= dt;
      if (s.life <= 0) { s.img.destroy(); this.splats.splice(i, 1); continue; }
      if (s.life < 8) s.img.setAlpha(Math.min(0.85, s.life / 8));
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.img.setVisible(false);
        this.pool.push(p.img);
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.img.setPosition(p.x, p.y).setAlpha(Math.min(1, p.life * 1.4));
    }
  }
}

/* ---------- barras de vida ---------- */

/** Barras de vida de todo mundo, redesenhadas a cada quadro num único Graphics (só retângulos: baratos). */
export class Bars {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(999_000);
  }

  begin() { this.g.clear(); }

  draw(x: number, y: number, ratio: number, width: number, color: number) {
    const h = 7, left = x - width / 2;
    this.g.fillStyle(0x3d230f, 1).fillRect(left - 2, y - 2, width + 4, h + 4);
    this.g.fillStyle(0x7a2a1a, 1).fillRect(left, y, width, h);
    if (ratio > 0) this.g.fillStyle(color, 1).fillRect(left, y, Math.max(4, width * ratio), h);
  }
}
