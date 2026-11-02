import Phaser from 'phaser';
import { sfx } from '../audio';
import { CASTLE_LEVELS } from '../data/castle';
import { Bars, Particles, popDamage } from '../fx';
import { Outline } from '../outline';
import { Structure } from './Building';

/** Centro da cidade. (x, y) é o centro da base. */
export class Castle implements Structure {
  level = 0;
  readonly sprite: Phaser.GameObjects.Image;
  private outline: Outline;
  w = 0;
  h = 0;
  maxHp = 1;
  hp = 1;
  private base = { sx: 1, sy: 1 };

  constructor(private scene: Phaser.Scene, readonly x: number, readonly y: number, private fx: Particles) {
    this.sprite = scene.add.image(x, y, CASTLE_LEVELS[0].art).setOrigin(0.5, 1).setDepth(y);
    this.outline = new Outline(scene, this.sprite);
    this.apply(true);
  }

  get alive() { return this.hp > 0; }
  get data() { return CASTLE_LEVELS[this.level]; }
  get income() { return this.data.income; }
  get hutMax() { return this.data.hutMax; }
  get maxed() { return this.level >= CASTLE_LEVELS.length - 1; }
  get next() { return this.maxed ? null : CASTLE_LEVELS[this.level + 1]; }

  setSelected(on: boolean) { this.outline.show(on); }

  contains(px: number, py: number) {
    return Math.abs(px - this.x) < this.w * 0.45 && py < this.y && py > this.y - this.h * 0.9;
  }

  /** Volta a um nível salvo, sem cobrar nada. */
  restore(level: number) {
    this.level = Phaser.Math.Clamp(level, 0, CASTLE_LEVELS.length - 1);
    this.apply(true);
  }

  upgrade() {
    if (this.maxed) return;
    this.level++;
    this.apply(false);
    this.fx.burst(this.x, this.y - this.h * 0.5, 40, 0xffd84a, true);
    this.fx.burst(this.x, this.y - this.h * 0.5, 20, 0xd070ff, true);
    this.scene.cameras.main.shake(250, 0.006);
  }

  private apply(first: boolean) {
    const lv = this.data;
    const tex = this.scene.textures.get(lv.art).getSourceImage();
    this.w = lv.width;
    this.h = lv.width * tex.height / tex.width;
    this.maxHp = lv.hp;
    this.hp = lv.hp; // evoluir também conserta
    this.sprite.setTexture(lv.art).setDisplaySize(this.w, this.h);
    const sx = this.sprite.scaleX, sy = this.sprite.scaleY;
    this.base = { sx, sy };
    this.sprite.setScale(sx * (first ? 1.4 : 1.25), sy * (first ? 0.4 : 0.6));
    this.scene.tweens.add({ targets: this.sprite, scaleX: sx, scaleY: sy, duration: 750, ease: 'Elastic.easeOut', easeParams: [1, 0.42] });
  }

  /** Ponto do castelo mais próximo de (px, py), para os inimigos baterem. */
  nearestPoint(px: number, py: number) {
    return {
      x: Phaser.Math.Clamp(px, this.x - this.w * 0.42, this.x + this.w * 0.42),
      y: Phaser.Math.Clamp(py, this.y - this.h * 0.55, this.y - 4),
    };
  }

  takeDamage(n: number, fromX: number, fromY: number) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - n);
    const p = this.nearestPoint(fromX, fromY);
    popDamage(this.scene, p.x, p.y - 20, n, true);
    sfx.thud();
    this.fx.burst(p.x, p.y, 4, 0xe8d9b8);
    // tremidinha
    this.scene.tweens.add({
      targets: this.sprite, scaleX: this.base.sx * 1.04, scaleY: this.base.sy * 0.97,
      duration: 70, yoyo: true,
    });
  }

  drawBar(bars: Bars) {
    if (this.hp < this.maxHp) bars.draw(this.x, this.y - this.h - 14, this.hp / this.maxHp, 140, 0x4cd137);
  }
}
