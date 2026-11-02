import Phaser from 'phaser';
import { Structure } from './Building';
import { Soldier } from './Soldier';
import { HutDef, SoldierSpec } from '../data/cabanas';
import { Bars, Particles, popDamage } from '../fx';
import { Outline } from '../outline';

/** Uma cabana que evolui de nível e abriga soldados. (x, y) é o centro da base. */
export class Hut implements Structure {
  level = 0;
  hp = 1;
  maxHp = 1;
  private ruined = false;
  readonly soldiers: Soldier[] = [];
  readonly sprite: Phaser.GameObjects.Image;
  private badge: Phaser.GameObjects.Text;
  private outline: Outline;
  w = 0;
  h = 0;

  constructor(private scene: Phaser.Scene, readonly def: HutDef, readonly x: number, readonly y: number, private fx: Particles, private onDestroyed: (h: Hut) => void) {
    this.sprite = scene.add.image(x, y, def.levels[0].art).setOrigin(0.5, 1).setDepth(y);
    this.badge = scene.add.text(x, y, '', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '15px', fontStyle: 'bold',
      color: '#fff', stroke: '#5a3418', strokeThickness: 5,
    }).setOrigin(0.5, 1).setDepth(y + 1);
    this.outline = new Outline(scene, this.sprite);
    this.apply(true);
  }

  get alive() { return !this.ruined && this.hp > 0; }

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
    this.fx.burst(p.x, p.y, 4, 0xe8d9b8);
    // tremidinha
    const sx = this.sprite.scaleX, sy = this.sprite.scaleY;
    this.scene.tweens.add({ targets: this.sprite, scaleX: sx * 1.05, scaleY: sy * 0.95, duration: 70, yoyo: true });
    if (this.hp <= 0) this.collapse();
  }

  private collapse() {
    this.ruined = true;
    this.fx.burst(this.x, this.y - this.h * 0.4, 36, 0xe8d9b8, true);
    this.fx.burst(this.x, this.y - this.h * 0.2, 16, 0x7a5a3a, true);
    for (const s of this.soldiers) s.destroy();
    this.soldiers.length = 0;
    this.outline.destroy();
    this.badge.destroy();
    this.scene.tweens.add({
      targets: this.sprite, scaleY: 0, alpha: 0, duration: 450, ease: 'Back.easeIn',
      onComplete: () => this.sprite.destroy(),
    });
    this.onDestroyed(this);
  }

  /** Cura devagar quando está tudo calmo. */
  heal(n: number) { if (this.alive) this.hp = Math.min(this.maxHp, this.hp + n); }

  drawBar(bars: Bars) {
    if (this.alive && this.hp < this.maxHp) bars.draw(this.x, this.y - this.h - 22, this.hp / this.maxHp, 70, 0x4cd137);
  }

  get maxed() { return this.level >= this.def.levels.length - 1; }
  get next() { return this.maxed ? null : this.def.levels[this.level + 1]; }

  setSelected(on: boolean) { this.outline.show(on); }

  contains(px: number, py: number) {
    return Math.abs(px - this.x) < this.w * 0.5 && py < this.y + 8 && py > this.y - this.h;
  }

  upgrade() {
    if (this.maxed) return;
    this.level++;
    this.apply(false);
    this.fx.burst(this.x, this.y - this.h * 0.4, 22, 0xffd84a, true);
  }

  private apply(first: boolean) {
    const lv = this.def.levels[this.level];
    const tex = this.scene.textures.get(lv.art).getSourceImage();
    this.maxHp = lv.hp;
    this.hp = lv.hp; // evoluir também conserta
    this.w = lv.width;
    this.h = lv.width * tex.height / tex.width;
    this.sprite.setTexture(lv.art).setDisplaySize(this.w, this.h);
    this.badge.setText('Nv ' + (this.level + 1)).setPosition(this.x, this.y - this.h - 4);

    // boing exagerado ao construir / evoluir
    const sx = this.sprite.scaleX, sy = this.sprite.scaleY;
    this.sprite.setScale(sx * (first ? 1.5 : 1.3), sy * (first ? 0.3 : 0.6));
    this.scene.tweens.add({ targets: this.sprite, scaleX: sx, scaleY: sy, duration: 700, ease: 'Elastic.easeOut', easeParams: [1, 0.4] });
    this.badge.setScale(0.2);
    this.scene.tweens.add({ targets: this.badge, scale: 1, duration: 450, ease: 'Back.easeOut' });

    this.reconcileSoldiers(first);
  }

  /** Ajusta os soldados ao nível: os existentes mudam de tipo, os novos pulam pra fora da porta. */
  private reconcileSoldiers(first: boolean) {
    const specs: SoldierSpec[] = [];
    for (const g of this.def.levels[this.level].soldiers) for (let i = 0; i < g.count; i++) specs.push(g);
    const n = specs.length;
    specs.forEach((spec, i) => {
      const s = this.soldiers[i];
      if (s) s.setSpec(spec);
      else {
        const ns = new Soldier(this.scene, this, (i / n) * Math.PI * 2, this.fx, spec);
        this.soldiers.push(ns);
        if (!first) this.fx.burst(ns.x, ns.y, 4, 0xffffff);
      }
    });
  }
}
