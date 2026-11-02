import Phaser from 'phaser';

const PAD = 10;

/** Cria (uma vez) uma versão da imagem engordada e pintada de amarelo, para servir de borda. */
function ensureOutline(scene: Phaser.Scene, key: string): string {
  const name = key + '_borda';
  if (scene.textures.exists(name)) return name;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const w = src.width, h = src.height;
  const tex = scene.textures.createCanvas(name, w + PAD * 2, h + PAD * 2);
  if (!tex) return key;
  const ctx = tex.getContext();
  for (const r of [PAD * 0.5, PAD]) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      ctx.drawImage(src, PAD + Math.cos(a) * r, PAD + Math.sin(a) * r);
    }
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffd84a';
  ctx.fillRect(0, 0, w + PAD * 2, h + PAD * 2);
  tex.refresh();
  return name;
}

/** Borda amarela piscando em volta da imagem inteira de uma construção. */
export class Outline {
  private img: Phaser.GameObjects.Image;
  private key = '';

  constructor(private scene: Phaser.Scene, private target: Phaser.GameObjects.Image) {
    this.img = scene.add.image(0, 0, target.texture.key).setVisible(false);
    scene.tweens.add({ targets: this.img, alpha: { from: 1, to: 0.2 }, yoyo: true, repeat: -1, duration: 380, ease: 'Sine.easeInOut' });
    scene.events.on('update', this.sync, this);
  }

  show(on: boolean) {
    this.img.setVisible(on);
    if (on) this.sync();
  }

  /** Acompanha a imagem da construção (posição, tamanho e troca de nível). */
  private sync() {
    if (!this.img.visible) return;
    const t = this.target;
    if (t.texture.key !== this.key) {
      this.key = t.texture.key;
      this.img.setTexture(ensureOutline(this.scene, this.key));
      const h = t.frame.height;
      this.img.setOrigin(0.5, (h + PAD) / (h + PAD * 2));
    }
    this.img.setPosition(t.x, t.y).setScale(t.scaleX, t.scaleY).setDepth(t.depth - 0.1);
  }

  destroy() {
    this.scene.events.off('update', this.sync, this);
    this.img.destroy();
  }
}
