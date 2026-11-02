import Phaser from 'phaser';
import { GRAVITY, SOLDIER_H } from '../config';
import { SoldierSpec, UNIT_ART } from '../data/cabanas';
import { AGGRO_RANGE, FURIA, LEASH_RANGE, RESPAWN_TIME, SOLDIER_RUN_SPEED, UNIT_STATS } from '../data/units';
import { Bars, Particles, popDamage } from '../fx';
import { Building } from './Building';
import { Combatant } from './Combatant';
import type { Orc } from './Orc';

export type SoldierState = 'orbit' | 'held' | 'fly' | 'dizzy' | 'return' | 'fight' | 'dead';

const ATTACK_TIME = 0.35;

export class Soldier implements Combatant {
  state: SoldierState = 'orbit';
  /** posição no chão; z é a altura acima do chão */
  x: number;
  y: number;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  spin = 0;
  rot = 0;
  /** vida e ataque, vindos do tipo de soldado */
  hp = 1;
  maxHp = 1;
  private dmg = 1;
  private reach = 30;
  private cd = 1;
  private runSpeed = SOLDIER_RUN_SPEED;
  /** recarga para o dano de arremesso */
  hitCd = 0;

  private angle: number;
  private dir = 1;
  private phase = Math.random() * 6;
  private hopBase = 7 + Math.random() * 1.5;
  private hopSpeed = this.hopBase;
  private face = 1;
  private timer = 0;
  private t = 0;
  private size = 1;

  private target: Orc | null = null;
  private cdT = 0;
  private atkT = 0;
  private atkHit = false;
  private ox = 0;
  private oy = 0;
  private hitT = 0;
  private rx = 0;
  private ry = 0;
  private respawnT = 0;

  readonly sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Ellipse;
  private aura: Phaser.GameObjects.Ellipse;
  private stars: Phaser.GameObjects.Text;
  private baseScale: number;
  private glow = 0;

  constructor(private scene: Phaser.Scene, private home: Building, angle: number, private fx: Particles, spec: SoldierSpec) {
    this.angle = angle;
    this.x = home.x;
    this.y = home.y;
    const tex = scene.textures.get('soldado').getSourceImage();
    this.baseScale = SOLDIER_H / tex.height;
    const w = tex.width * this.baseScale;
    this.aura = scene.add.ellipse(this.x, this.y, w * 1.5, w * 0.5, 0xffd84a, 0.35).setVisible(false);
    this.shadow = scene.add.ellipse(this.x, this.y, w * 0.8, w * 0.24, 0x000000, 0.22);
    this.sprite = scene.add.image(this.x, this.y, 'soldado').setOrigin(0.5, 1).setScale(this.baseScale);
    this.stars = scene.add.text(0, 0, '★ ★ ★', { fontSize: '14px', color: '#f2b705' }).setOrigin(0.5).setVisible(false);
    this.setSpec(spec);
  }

  get alive() { return this.state !== 'dead' && this.hp > 0; }
  /** inimigos só batem em quem está em pé no chão */
  get attackable() { return this.state === 'orbit' || this.state === 'return' || this.state === 'fight'; }
  get speed() { return Math.hypot(this.vx, this.vy); }

  /** Troca o desenho (espada, lança, alabarda), o brilho e os números de combate. */
  setSpec(spec: SoldierSpec) {
    const art = this.scene.textures.exists(UNIT_ART[spec.unit]) ? UNIT_ART[spec.unit] : 'soldado';
    const tex = this.scene.textures.get(art).getSourceImage();
    this.baseScale = SOLDIER_H / tex.height;
    this.sprite.setTexture(art);
    // unidades melhores são um pouco maiores
    this.size = (spec.unit === 'espada' ? 1 : spec.unit === 'lanca' ? 1.1 : 1.2) * (spec.furia ? 1.1 : 1);
    this.hopSpeed = this.hopBase * (spec.furia ? 1.35 : 1);
    this.glow = spec.furia ? 0xff3b30 : spec.unit === 'alabarda' ? 0xffd84a : 0;
    this.aura.setVisible(this.glow !== 0 && this.alive);
    if (this.glow) this.aura.setFillStyle(this.glow, 0.38);
    if (spec.furia) this.sprite.setTint(0xff9a9a); else this.sprite.clearTint();

    const st = UNIT_STATS[spec.unit];
    const f = spec.furia;
    this.maxHp = Math.round(st.hp * (f ? FURIA.hp : 1));
    this.hp = this.maxHp; // evoluir também cura
    this.dmg = Math.round(st.dmg * (f ? FURIA.dmg : 1));
    this.reach = st.reach;
    this.cd = st.cd * (f ? FURIA.cd : 1);
    this.runSpeed = SOLDIER_RUN_SPEED * (f ? FURIA.speed : 1);
  }

  /** Distância até o centro do corpo na tela, para detectar o clique. */
  hitDistance(px: number, py: number) {
    return Math.hypot(px - this.x, py - (this.y - this.z - SOLDIER_H / 2));
  }

  grab() {
    this.state = 'held';
    this.target = null;
    this.atkT = 0;
    this.ox = this.oy = 0;
    this.vx = this.vy = 0;
    this.rot = 0;
  }

  throwWith(vx: number, vy: number) {
    const sp = Math.hypot(vx, vy);
    this.state = 'fly';
    this.vx = vx;
    this.vy = vy;
    this.vz = sp < 80 ? 120 : Math.min(260 + sp * 0.22, 900);
    this.spin = sp < 80 ? 3 : (vx >= 0 ? 1 : -1) * (8 + sp / 90);
    this.fx.burst(this.x, this.y - this.z, 6, 0xffffff);
  }

  takeDamage(n: number, fromX: number, fromY: number) {
    if (!this.attackable) return;
    this.hp = Math.max(0, this.hp - n);
    this.hitT = 0.2;
    popDamage(this.scene, this.x, this.y - this.z - SOLDIER_H * this.size - 4, n, true);
    this.fx.burst(this.x, this.y - SOLDIER_H * 0.5, 4, 0xff8a7a);
    this.fx.blood(this.x, this.y - SOLDIER_H * 0.5, this.y, Math.min(30, 3 + n * 0.45));
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.rx = (this.x - fromX) / d * 14;
    this.ry = (this.y - fromY) / d * 7;
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.state = 'dead';
    this.target = null;
    this.atkT = 0;
    this.ox = this.oy = 0;
    this.respawnT = RESPAWN_TIME;
    this.fx.burst(this.x, this.y - SOLDIER_H * 0.5, 14, 0xffffff, true);
    this.fx.blood(this.x, this.y - SOLDIER_H * 0.5, this.y, 16);
    this.setVisible(false);
  }

  private revive() {
    this.hp = this.maxHp;
    this.state = 'orbit';
    this.z = 0;
    this.x = this.home.x;
    this.y = this.home.y;
    this.setVisible(true);
    this.fx.burst(this.x, this.y, 8, 0xffffff);
  }

  /** Tira o soldado do mapa de vez (cabana destruída). */
  destroy() {
    this.state = 'dead';
    this.respawnT = Infinity;
    this.fx.burst(this.x, this.y - SOLDIER_H * 0.5, 8, 0xffffff);
    this.sprite.destroy();
    this.shadow.destroy();
    this.aura.destroy();
    this.stars.destroy();
  }

  private setVisible(on: boolean) {
    this.sprite.setVisible(on);
    this.shadow.setVisible(on);
    this.aura.setVisible(on && this.glow !== 0);
    if (!on) this.stars.setVisible(false);
  }

  private orbitPoint() {
    const rx = this.home.w * 0.5 + 34;
    return {
      x: this.home.x + Math.cos(this.angle) * rx,
      y: this.home.y + Math.sin(this.angle) * rx * 0.3,
    };
  }

  private nearestFoe(foes: Orc[]) {
    let best: Orc | null = null, bd = AGGRO_RANGE;
    for (const o of foes) {
      if (!o.alive) continue;
      const d = Math.hypot(o.x - this.home.x, o.y - this.home.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** floor = limite de baixo da área jogável */
  update(dt: number, mouse: Phaser.Math.Vector2, w: number, floor: number, foes: Orc[], bars: Bars) {
    this.t += dt;
    if (this.state === 'dead') {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.revive();
      return;
    }
    this.cdT -= dt;
    this.hitCd -= dt;
    this.hitT = Math.max(0, this.hitT - dt);
    this.rx *= Math.pow(0.001, dt);
    this.ry *= Math.pow(0.001, dt);

    const hopping = this.state === 'orbit' || this.state === 'return';
    if (hopping) this.phase += dt * (this.state === 'return' ? this.hopSpeed * 1.9 : this.hopSpeed);

    switch (this.state) {
      case 'orbit': {
        this.angle += dt * 0.55 * this.dir;
        const p = this.orbitPoint();
        this.face = -Math.sin(this.angle) * this.dir >= 0 ? 1 : -1;
        this.x = p.x;
        this.y = p.y;
        this.z = Math.abs(Math.sin(this.phase)) * 16;
        const foe = this.nearestFoe(foes);
        if (foe) { this.target = foe; this.state = 'fight'; this.phase = 0; }
        break;
      }
      case 'return': {
        this.angle += dt * 0.55 * this.dir;
        const p = this.orbitPoint();
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy), step = 520 * dt;
        if (d < step + 8) {
          this.state = 'orbit';
        } else {
          this.x += dx / d * step;
          this.y += dy / d * step;
          this.face = dx >= 0 ? 1 : -1;
        }
        this.z = Math.abs(Math.sin(this.phase)) * 30;
        break;
      }
      case 'fight': this.fight(dt, foes); break;
      case 'held': {
        const k = Math.min(1, dt * 30);
        this.x += (mouse.x - this.x) * k;
        this.y += (mouse.y + SOLDIER_H * 0.4 - this.y) * k;
        this.z = SOLDIER_H * 0.4;
        this.rot = Math.sin(this.t * 20) * 0.25;
        this.face = 1;
        break;
      }
      case 'fly': {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.z += this.vz * dt;
        this.vz -= GRAVITY * dt;
        this.rot += this.spin * dt;
        if (this.x < 20) { this.x = 20; this.vx = Math.abs(this.vx) * 0.7; }
        if (this.x > w - 20) { this.x = w - 20; this.vx = -Math.abs(this.vx) * 0.7; }
        if (this.y < 80) { this.y = 80; this.vy = Math.abs(this.vy) * 0.7; }
        if (this.y > floor) { this.y = floor; this.vy = -Math.abs(this.vy) * 0.7; }
        if (this.z <= 0) {
          this.z = 0;
          if (this.vz < -260) {
            this.vz = -this.vz * 0.45;
            this.vx *= 0.6;
            this.vy *= 0.6;
            this.spin *= 0.6;
            this.fx.burst(this.x, this.y, 5, 0xb7d08a);
          } else {
            this.state = 'dizzy';
            this.timer = 0.7;
            this.rot = 0;
            this.vz = 0;
            this.fx.burst(this.x, this.y, 9, 0xb7d08a);
          }
        }
        break;
      }
      case 'dizzy': {
        this.timer -= dt;
        this.z = 0;
        this.rot = Math.sin(this.t * 25) * 0.2;
        if (this.timer <= 0) {
          this.state = 'return';
          this.rot = 0;
          this.phase = 0;
        }
        break;
      }
    }
    // pode ter morrido durante o quadro
    if (this.alive) this.render(bars);
  }

  /** Vai até o orc e bate com o corpo todo. */
  private fight(dt: number, foes: Orc[]) {
    if (!this.target || !this.target.alive) {
      this.target = this.nearestFoe(foes);
      if (!this.target) { this.state = 'return'; this.phase = 0; return; }
    }
    const tg = this.target;
    // longe demais da cabana: desiste e volta
    if (Math.hypot(this.x - this.home.x, this.y - this.home.y) > LEASH_RANGE) {
      this.target = null;
      this.state = 'return';
      this.phase = 0;
      return;
    }
    const dx = tg.x - this.x, dy = tg.y - this.y, dist = Math.hypot(dx, dy);
    this.z = 0;

    if (this.atkT > 0) {
      const prev = this.atkT;
      this.atkT += dt / ATTACK_TIME;
      if (prev < 0.5 && this.atkT >= 0.5 && !this.atkHit) {
        this.atkHit = true;
        tg.takeDamage(this.dmg, this.x, this.y);
      }
      const lunge = Math.sin(Math.min(1, this.atkT) * Math.PI) * 22;
      const d = dist || 1;
      this.ox = dx / d * lunge;
      this.oy = dy / d * lunge * 0.6;
      if (this.atkT >= 1) { this.atkT = 0; this.ox = this.oy = 0; }
    } else if (dist > this.reach) {
      this.phase += dt * this.hopSpeed * 1.6;
      this.x += dx / dist * this.runSpeed * dt;
      this.y += dy / dist * this.runSpeed * dt;
      this.z = Math.abs(Math.sin(this.phase)) * 14;
      if (Math.abs(dx) > 4) this.face = dx >= 0 ? 1 : -1;
    } else {
      if (Math.abs(dx) > 4) this.face = dx >= 0 ? 1 : -1;
      if (this.cdT <= 0) {
        this.cdT = this.cd;
        this.atkT = 0.001;
        this.atkHit = false;
      }
    }
  }

  private render(bars: Bars) {
    let sx = 1, sy = 1;
    const hopping = this.state === 'orbit' || this.state === 'return';
    const running = this.state === 'fight' && this.atkT === 0;
    if (hopping || running) {
      // canguru: estica no ar, achata ao pousar
      const ph = Math.abs(Math.sin(this.phase));
      sy = 1 + ph * 0.22 - (1 - ph) * 0.18;
      sx = 2 - sy;
    } else if (this.state === 'held') { sx = 0.9; sy = 1.2; }
    else if (this.state === 'fly') { sx = 0.95; sy = 1.1; }
    else if (this.state === 'dizzy') { sx = 1.2; sy = 0.82; }
    else if (this.state === 'fight' && this.atkT > 0) {
      // prepara o golpe (encolhe) e solta (estica)
      sy = this.atkT < 0.5 ? 0.88 : 1.12;
      sx = 2 - sy;
    }
    if (this.hitT > 0) {
      const k = Math.sin(this.hitT / 0.2 * Math.PI) * 0.22;
      sx *= 1 + k;
      sy *= 1 - k;
    }

    const px = this.x + this.ox + this.rx, py = this.y + this.oy + this.ry;
    const k = Math.max(0.4, 1 - this.z / 160);
    this.shadow.setPosition(px, py).setScale(k).setDepth(py - 1);
    if (this.aura.visible) {
      this.aura.setPosition(px, py).setScale(k * (1 + Math.sin(this.t * 6) * 0.12)).setDepth(py - 2);
    }

    const lean = (hopping || running) ? Math.sin(this.phase) * 0.12 * this.face : 0;
    this.sprite.setPosition(px, py - this.z + 2)
      .setScale(this.baseScale * this.size * sx * this.face, this.baseScale * this.size * sy)
      .setRotation(this.rot + lean)
      .setDepth(this.state === 'held' ? 500_000 : py);

    const dizzy = this.state === 'dizzy';
    this.stars.setVisible(dizzy);
    if (dizzy) {
      this.stars.setPosition(px + Math.cos(this.t * 8) * 10, py - SOLDIER_H - 4).setDepth(500_001);
    }
    if (this.hp < this.maxHp && this.state !== 'held') {
      bars.draw(px, py - this.z - SOLDIER_H * this.size - 14, this.hp / this.maxHp, 30, 0x4cd137);
    }
  }
}
