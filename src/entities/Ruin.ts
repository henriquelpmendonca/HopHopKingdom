import Phaser from 'phaser';
import type { HutDef } from '../data/cabanas';

/**
 * Escombros de uma construção destruída, montados com as peças genéricas (ruina_01..16, feitas no estilo das casas):
 * pedaços de parede, vigas, porta, janela, telhado e bandeira. Telhado e bandeira levam a cor da casa que caiu,
 * então qualquer casa ganha escombros próprios sem precisar de um desenho para cada uma.
 * Guarda o tipo e o nível: a casa volta igual quando a onda acaba (de graça) ou antes, pagando.
 */
const STONE = [1, 2, 3, 4], BEAM = [5, 6, 7], DOOR = 8, WINDOW = 9, ROOF = [10, 11, 12], FLAG = 13, PEBBLES = 14, BASE = 15, BRICKS = 16;
const key = (n: number) => 'ruina_' + String(n).padStart(2, '0');

/** cor do telhado de cada casa (as minas não têm telhado) */
function roofColor(id: string): number | null {
  if (id.includes('mina')) return null;
  if (id.includes('gigante')) return 0xf0b040;
  if (id.includes('bomba')) return 0x5a5564;
  if (id.includes('quicador')) return 0x3f7fe0;
  if (id.includes('gelo')) return 0xa8dcff;
  if (id.includes('mago') || id.includes('estudo')) return 0x9a63d6;
  if (id.includes('arqueiro')) return 0x6aa84a;
  return 0xd06a4f;
}

export class Ruin {
  private parts: Phaser.GameObjects.Image[] = [];
  private glow: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, readonly def: HutDef, readonly x: number, readonly y: number, readonly level: number, readonly w: number, readonly h: number) {
    let seed = Math.abs(Math.round(x * 7 + y * 13)) + 1;
    const r = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
    const ok = scene.textures.exists(key(BASE));
    this.glow = scene.add.image(x, y - w * 0.08, 'soft').setTint(0xffe45a).setAlpha(0).setDepth(y - 6)
      .setScale(w / 64 * 1.2, w / 64 * 0.55);
    if (!ok) {
      // sem as peças (arquivo faltando): o monte simples de pedras
      this.add('ruina', x, y + 6, w * 0.8, 0, false, y - 1, null);
      return;
    }
    const roof = roofColor(def.id);
    // monte de entulho por baixo de tudo
    this.add(key(BASE), x, y + 6, w * 0.95, 0, false, y - 4, null);
    const list: { n: number; size: number; tint: number | null }[] = [];
    if (roof !== null) {
      list.push({ n: pick(ROOF), size: 0.36, tint: roof }, { n: pick(ROOF), size: 0.32, tint: roof });
      list.push({ n: r() < 0.5 ? DOOR : WINDOW, size: 0.22, tint: null });
      list.push({ n: FLAG, size: 0.26, tint: roof });
    }
    list.push({ n: pick(STONE), size: 0.32, tint: null }, { n: pick(STONE), size: 0.26, tint: null });
    list.push({ n: pick(BEAM), size: 0.36, tint: null }, { n: pick(BEAM), size: 0.3, tint: null });
    if (roof === null) list.push({ n: pick(STONE), size: 0.3, tint: null }, { n: pick(BEAM), size: 0.34, tint: null }, { n: PEBBLES, size: 0.3, tint: null });
    list.push({ n: r() < 0.5 ? BRICKS : PEBBLES, size: 0.2, tint: null });
    // espalha pelo chão da casa; quem fica mais à frente é desenhado por cima
    const placed = list.map(p => ({ ...p, px: x + (r() - 0.5) * w * 0.7, py: y - r() * w * 0.2, rot: (r() - 0.5) * 0.3, flip: r() < 0.5 }));
    placed.sort((a, b) => a.py - b.py);
    placed.forEach((p, i) => {
      const rot = p.n === FLAG ? -0.25 + r() * 0.3 : p.rot;
      this.add(key(p.n), p.px, p.py, w * p.size, rot, p.flip, p.py + i * 0.01, p.tint, 120 + i * 45);
    });
  }

  private add(k: string, x: number, y: number, width: number, rot: number, flip: boolean, depth: number, tint: number | null, delay = 60) {
    const img = this.scene.add.image(x, y, k).setOrigin(0.5, 0.92).setDepth(depth).setRotation(rot).setFlipX(flip);
    const s = width / img.width;
    if (tint !== null) img.setTint(tint);
    img.setScale(0);
    // as peças caem e quicam no lugar
    this.scene.tweens.add({ targets: img, scale: s, delay, duration: 380, ease: 'Back.easeOut' });
    this.parts.push(img);
  }

  /** o clique pega o monte de escombros (bem mais baixo que a casa) */
  contains(px: number, py: number) {
    return Math.abs(px - this.x) < this.w * 0.5 && py < this.y + 14 && py > this.y - this.w * 0.45;
  }

  setSelected(on: boolean) {
    this.scene.tweens.killTweensOf(this.glow);
    if (on) this.scene.tweens.add({ targets: this.glow, alpha: { from: 0.75, to: 0.25 }, duration: 420, yoyo: true, repeat: -1 });
    else this.glow.setAlpha(0);
  }

  destroy() {
    for (const p of this.parts) p.destroy();
    this.parts = [];
    this.scene.tweens.killTweensOf(this.glow);
    this.glow.destroy();
  }
}
