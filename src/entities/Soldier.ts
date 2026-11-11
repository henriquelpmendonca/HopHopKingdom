import Phaser from 'phaser';
import { sfx } from '../audio';
import { GRAVITY, SOLDIER_H } from '../config';
import { SoldierSpec, UNIT_ART } from '../data/cabanas';
import { perkMult } from '../meta';
import { COMBAT, SPECIAL_ART, SPECIAL_MIGHT, SPECIAL_SIZE } from '../data/special';
import { t } from '../i18n';
import { AGGRO_RANGE, FURIA, SPELL, type Spell, LEASH_RANGE, RESPAWN_TIME, SOLDIER_RUN_SPEED, UNIT_STATS } from '../data/units';
import { Bars, floatText, Particles, popDamage } from '../fx';
import { Building } from './Building';
import { Combatant } from './Combatant';
import type { Orc } from './Orc';
import { FIRE, ICE, type Projectiles } from './Projectile';

export type SoldierState = 'orbit' | 'held' | 'fly' | 'dizzy' | 'return' | 'fight' | 'dead';

const ATTACK_TIME = 0.35;

/** Vida, dano e tempo entre golpes de um soldado da especificação `spec` (com as melhorias da Forja). */
export function specStats(spec: SoldierSpec) {
  const st = UNIT_STATS[spec.unit], kind = spec.special, f = spec.furia;
  const pw = (spec.power ?? 1) * perkMult('strong');
  const mh = kind ? SPECIAL_MIGHT[kind].hp : 1, md = kind ? SPECIAL_MIGHT[kind].dmg : 1;
  let cd = st.cd * (f ? FURIA.cd : 1) / perkMult('haste');
  if (kind === 'bomba') cd *= COMBAT.bombCdMult;
  if (kind === 'gigante') cd *= COMBAT.giantCdMult;
  if (kind === 'gelo') cd = Math.max(cd, COMBAT.iceCdMin);
  return { hp: Math.round(st.hp * pw * (f ? FURIA.hp : 1) * mh), dmg: Math.round(st.dmg * pw * (f ? FURIA.dmg : 1) * md), cd };
}

export class Soldier implements Combatant {
  /** todos os soldados vivos no mapa (o quicador chama os aliados de perto para pular junto) */
  private static all = new Set<Soldier>();
  /** segundos que ainda está pulando para desviar (não leva dano enquanto isso) */
  private evadeT = 0;
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
  /** arqueiro: atira desta distância */
  private range = 0;
  /** mago: atira magia azul em vez de flecha */
  private bolt = false;
  private spells: Spell[] = [];
  private spellIdx = 0;
  /** distância da cabana em que nota inimigos, e até onde vai atrás deles */
  private aggro = AGGRO_RANGE;
  private leash = LEASH_RANGE;
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
  /** comemoração: segundos de dancinha que faltam (e um atraso, para não pularem todos juntos) */
  private cheerT = 0;
  private cheerDelay = 0;
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
  private spec!: SoldierSpec;
  readonly sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  /** as estrelinhas de tonto só são criadas na primeira vez que precisam */
  private stars?: Phaser.GameObjects.Text;
  private shadowBase: [number, number] = [1, 1];
  private auraBase: [number, number] = [1, 1];
  private baseScale: number;
  private glow = 0;

  constructor(private scene: Phaser.Scene, private home: Building, angle: number, private fx: Particles, spec: SoldierSpec) {
    this.angle = angle;
    this.x = home.x;
    this.y = home.y;
    const tex = scene.textures.get('soldado').getSourceImage();
    this.baseScale = SOLDIER_H / tex.height;
    const w = tex.width * this.baseScale;
    this.auraBase = [w * 1.9 / 64, w * 0.7 / 64];
    this.shadowBase = [w * 1.1 / 64, w * 0.34 / 64];
    this.aura = scene.add.image(this.x, this.y, 'soft').setTint(0xffd84a).setAlpha(0.55).setVisible(false);
    this.shadow = scene.add.image(this.x, this.y, 'soft').setTint(0x000000).setAlpha(0.32).setScale(...this.shadowBase);
    this.sprite = scene.add.image(this.x, this.y, 'soldado').setOrigin(0.5, 1).setScale(this.baseScale);
    this.setSpec(spec);
    Soldier.all.add(this);
  }

  get alive() { return this.state !== 'dead' && this.hp > 0; }
  /** inimigos só batem em quem está em pé no chão */
  get attackable() { return this.state === 'orbit' || this.state === 'return' || this.state === 'fight'; }
  get speed() { return Math.hypot(this.vx, this.vy); }

  /** Troca o desenho (espada, lança, alabarda), o brilho e os números de combate. */
  setSpec(spec: SoldierSpec) {
    this.spec = spec;
    const kind = spec.special;
    const own = kind && this.scene.textures.exists(SPECIAL_ART[kind]) ? SPECIAL_ART[kind] : null;
    const art = own ?? (this.scene.textures.exists(UNIT_ART[spec.unit]) ? UNIT_ART[spec.unit] : 'soldado');
    const tex = this.scene.textures.get(art).getSourceImage();
    this.baseScale = SOLDIER_H / tex.height;
    this.sprite.setTexture(art);
    // unidades melhores são um pouco maiores
    // os soldados de corpo a corpo são maiores que o arqueiro; lança e alabarda crescem junto
    const unitSize = { espada: 1.7, lanca: 1.8, alabarda: 1.9, arqueiro: 1.4, arqueiro2: 1.5, arqueiro3: 1.6, magoA1: 1.5, magoA2: 1.6, magoA3: 1.8 }[spec.unit];
    this.size = kind && own ? SPECIAL_SIZE[kind] : unitSize * (spec.furia ? 1.1 : 1);
    this.hopSpeed = this.hopBase * (spec.furia ? 1.35 : 1);
    this.glow = kind ? 0 : spec.furia ? 0xff3b30 : spec.unit === 'alabarda' ? 0xffd84a : 0;
    this.aura.setVisible(this.glow !== 0 && this.alive);
    if (this.glow) this.aura.setTint(this.glow);
    if (!kind && spec.furia) this.sprite.setTint(0xff9a9a); else this.sprite.clearTint();

    const st = UNIT_STATS[spec.unit];
    const f = spec.furia;
    const ss = specStats(spec);
    this.maxHp = ss.hp;
    this.hp = this.maxHp; // evoluir também cura
    this.dmg = ss.dmg;
    this.reach = st.reach;
    this.range = st.range ?? 0;
    this.bolt = !!st.bolt;
    this.spells = st.spells ?? [];
    this.aggro = st.aggro ?? AGGRO_RANGE;
    this.leash = Math.max(LEASH_RANGE, this.aggro + 120);
    this.cd = st.cd * (f ? FURIA.cd : 1) / perkMult('haste');
    this.runSpeed = SOLDIER_RUN_SPEED * (f ? FURIA.speed : 1);
    if (kind === 'bomba') this.cd *= COMBAT.bombCdMult;
    if (kind === 'gigante') { this.cd *= COMBAT.giantCdMult; this.reach = Math.round(this.reach * COMBAT.giantReach); }
    if (kind === 'gelo') {
      // ataca de longe com bolas de gelo
      this.range = COMBAT.iceRange;
      this.bolt = true;
      this.spells = ['ice'];
      this.aggro = Math.max(this.aggro, 740);
      this.leash = Math.max(LEASH_RANGE, this.aggro + 120);
      this.cd = Math.max(this.cd, COMBAT.iceCdMin);
    }
  }

  /** Uma melhoria da Forja Real foi comprada: refaz os números sem curar nem reviver ninguém. */
  rescale() {
    const was = this.alive;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    this.setSpec(this.spec);
    this.hp = was ? Math.max(1, Math.round(this.maxHp * ratio)) : 0;
  }

  /** Cidade reerguida: todo mundo volta inteiro para perto da cabana. */
  renew() {
    if (this.state === 'dead') { this.revive(); return; }
    this.hp = this.maxHp;
    if (this.state !== 'held') {
      this.state = 'orbit';
      this.target = null;
      this.atkT = 0;
      this.ox = this.oy = 0;
    }
  }

  /** Mago aliado: lança o próximo feitiço do rodízio (fogo, gelo ou raio). */
  private castSpell(tg: Orc, foes: Orc[], proj: Projectiles, aim: () => { x: number; y: number }) {
    const spell = this.spells[this.spellIdx++ % Math.max(1, this.spells.length)] ?? 'fire';
    const sx = this.x + this.face * 10, sy = this.y - SOLDIER_H * 0.7;
    if (spell === 'fire') {
      sfx.magic();
      proj.fire(sx, sy, tg, aim, this.dmg, 400, 1, 'magic', FIRE, t => (t as Orc).ignite(this.dmg * SPELL.burnDps, SPELL.burnSeconds));
    } else if (spell === 'ice') {
      sfx.magic();
      proj.fire(sx, sy, tg, aim, Math.round(this.dmg * 0.8), 440, 0.9, 'magic', ICE, t => (t as Orc).freeze(this.spec.special === 'gelo' ? COMBAT.iceFreeze : SPELL.freezeSeconds));
    } else {
      // raio: acerta o alvo e pula para os inimigos mais perto, um depois do outro
      const hit: Orc[] = [tg];
      let from = tg;
      for (let j = 0; j < SPELL.chainJumps; j++) {
        let best: Orc | null = null, bd = SPELL.chainRange;
        for (const o of foes) {
          if (!o.alive || hit.includes(o)) continue;
          const d = Math.hypot(o.x - from.x, o.y - from.y);
          if (d < bd) { bd = d; best = o; }
        }
        if (!best) break;
        hit.push(best);
        from = best;
      }
      proj.chain(sx, sy, hit.map(o => ({ target: o, x: o.x, y: o.y - o.stats.height * 0.5 })), Math.round(this.dmg * 0.9), SPELL.chainFalloff, SPELL.chainStep);
    }
  }

  /** Distância até o centro do corpo na tela, para detectar o clique. */
  hitDistance(px: number, py: number) {
    return Math.hypot(px - this.x, py - (this.y - this.z - SOLDIER_H / 2));
  }

  grab() {
    sfx.grab();
    this.state = 'held';
    this.target = null;
    this.atkT = 0;
    this.ox = this.oy = 0;
    this.vx = this.vy = 0;
    this.rot = 0;
  }

  throwWith(vx: number, vy: number) {
    const sp = Math.hypot(vx, vy);
    sfx.throw();
    this.state = 'fly';
    this.vx = vx;
    this.vy = vy;
    this.vz = sp < 80 ? 120 : Math.min(260 + sp * 0.22, 900);
    this.spin = sp < 80 ? 3 : (vx >= 0 ? 1 : -1) * (8 + sp / 90);
    this.fx.burst(this.x, this.y - this.z, 6, 0xffffff);
  }

  takeDamage(n: number, fromX: number, fromY: number) {
    if (!this.attackable) return;
    // pulando para desviar (por conta própria ou junto com um quicador): nada acerta
    if (this.evadeT > 0) return;
    if (this.spec.special === 'quicador' && Math.random() < COMBAT.dodgeChance) { this.dodge(); return; }
    // o gigante aguenta pancada: só leva uma parte do dano
    if (this.spec.special === 'gigante') n = Math.max(1, Math.round(n * COMBAT.giantArmor));
    this.hp = Math.max(0, this.hp - n);
    this.hitT = 0.2;
    popDamage(this.scene, this.x, this.y - this.z - SOLDIER_H * this.size - 4, n, true);
    sfx.hit();
    this.fx.burst(this.x, this.y - SOLDIER_H * 0.5, 4, 0xff8a7a);
    this.fx.blood(this.x, this.y - SOLDIER_H * 0.5, this.y, Math.min(30, 3 + n * 0.45));
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.rx = (this.x - fromX) / d * 14;
    this.ry = (this.y - fromY) / d * 7;
    if (this.hp <= 0) this.die();
  }

  /** O quicador pulou e desviou do golpe; quem está perto dele pula junto e também escapa. */
  private dodge() {
    this.evadeT = COMBAT.evadeSeconds;
    floatText(this.scene, this.x, this.y - SOLDIER_H * this.size - 12, t('fl.dodge'), '#9ad8ff');
    this.fx.burst(this.x, this.y - 6, 6, 0x9ad8ff);
    for (const a of Soldier.all) {
      if (a === this || !a.alive || !a.attackable || a.evadeT > 0) continue;
      if (Math.hypot(a.x - this.x, a.y - this.y) < COMBAT.dodgeShare) a.evadeT = COMBAT.evadeSeconds;
    }
  }

  /** O bombardeiro joga uma bomba: explode em área em volta do alvo. */
  private bombBlast(tg: Orc, foes: Orc[]) {
    const x = tg.x, y = tg.y;
    for (const o of foes) {
      if (o.alive && Math.hypot(o.x - x, (o.y - y) * 2) < COMBAT.bombRadius) o.takeDamage(this.dmg, x, y);
    }
    if (this.scene.textures.exists('explosao')) {
      const img = this.scene.add.image(x, y - 18, 'explosao').setOrigin(0.5, 0.6).setDepth(y + 2000);
      const full = COMBAT.bombRadius * 2.1 / img.width;
      img.setScale(full * 0.3);
      this.scene.tweens.add({ targets: img, scale: full, duration: 140, ease: 'Back.easeOut' });
      this.scene.tweens.add({ targets: img, alpha: 0, delay: 170, duration: 220, onComplete: () => img.destroy() });
    }
    this.fx.burst(x, y - 18, 14, 0xffa63a, true);
    sfx.crush();
  }

  private die() {
    this.state = 'dead';
    this.target = null;
    this.atkT = 0;
    this.ox = this.oy = 0;
    this.respawnT = RESPAWN_TIME;
    sfx.pop();
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
    Soldier.all.delete(this);
    this.sprite.destroy();
    this.shadow.destroy();
    this.aura.destroy();
    this.stars?.destroy();
  }

  private setVisible(on: boolean) {
    this.sprite.setVisible(on);
    this.shadow.setVisible(on);
    this.aura.setVisible(on && this.glow !== 0);
    if (!on) this.stars?.setVisible(false);
  }

  private orbitPoint() {
    const rx = this.home.w * 0.5 + 34;
    return {
      x: this.home.x + Math.cos(this.angle) * rx,
      y: this.home.y + Math.sin(this.angle) * rx * 0.3,
    };
  }

  private nearestFoe(foes: Orc[]) {
    let best: Orc | null = null, bd = this.aggro;
    for (const o of foes) {
      if (!o.alive) continue;
      const d = Math.hypot(o.x - this.home.x, o.y - this.home.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** floor = limite de baixo da área jogável */
  update(dt: number, mouse: Phaser.Math.Vector2, w: number, floor: number, foes: Orc[], bars: Bars, proj: Projectiles) {
    this.t += dt;
    if (this.cheerDelay > 0) this.cheerDelay -= dt; else if (this.cheerT > 0) this.cheerT -= dt;
    if (this.state === 'dead') {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.revive();
      return;
    }
    this.cdT -= dt;
    this.hitCd -= dt;
    this.hitT = Math.max(0, this.hitT - dt);
    this.evadeT = Math.max(0, this.evadeT - dt);
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
      case 'fight': this.fight(dt, foes, proj); break;
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
  private fight(dt: number, foes: Orc[], proj: Projectiles) {
    if (!this.target || !this.target.alive) {
      this.target = this.nearestFoe(foes);
      if (!this.target) { this.state = 'return'; this.phase = 0; return; }
    }
    const tg = this.target;
    // longe demais da cabana: desiste e volta
    if (Math.hypot(this.x - this.home.x, this.y - this.home.y) > this.leash) {
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
        if (this.spec.special === 'bomba') {
          // bombardeiro (de perto ou de longe): cada ataque é uma bomba que explode em área
          this.bombBlast(tg, foes);
        } else if (this.range > 0) {
          // arqueiro: solta uma flecha em direção ao inimigo
          const aim = () => ({ x: tg.x, y: tg.y - tg.stats.height * 0.5 });
          if (this.bolt) this.castSpell(tg, foes, proj, aim);
          else proj.fire(this.x + this.face * 10, this.y - SOLDIER_H * 0.65, tg, aim, this.dmg, 560, 1, 'arrow');
        } else {
          tg.takeDamage(this.dmg, this.x, this.y);
        }
      }
      // o arqueiro não avança no inimigo: só se encolhe para soltar a flecha
      const lunge = this.range > 0 ? 0 : Math.sin(Math.min(1, this.atkT) * Math.PI) * 22;
      const d = dist || 1;
      this.ox = dx / d * lunge;
      this.oy = dy / d * lunge * 0.6;
      if (this.atkT >= 1) { this.atkT = 0; this.ox = this.oy = 0; }
    } else if (dist > (this.range > 0 ? this.range * 0.9 : this.reach)) {
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

  /** Dancinha de comemoração: pulos altos e balanço de um lado para o outro. */
  cheer(seconds: number) {
    this.cheerDelay = Math.random() * 0.35;
    this.cheerT = seconds;
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
    // pulo de esquiva: sobe e desce em arco
    const jz = this.evadeT > 0 ? Math.sin((1 - this.evadeT / COMBAT.evadeSeconds) * Math.PI) * COMBAT.dodgeHeight : 0;
    const k = Math.max(0.4, 1 - (this.z + jz) / 160);
    this.shadow.setPosition(px, py).setScale(this.shadowBase[0] * k, this.shadowBase[1] * k).setDepth(py - 1);
    if (this.aura.visible) {
      const pulse = k * (1 + Math.sin(this.t * 6) * 0.12);
      this.aura.setPosition(px, py).setScale(this.auraBase[0] * pulse, this.auraBase[1] * pulse).setDepth(py - 2);
    }

    const lean = (hopping || running) ? Math.sin(this.phase) * 0.12 * this.face : 0;
    // dancinha: pula mais alto e balança
    let cz = 0, cr = 0;
    if (this.cheerT > 0 && this.cheerDelay <= 0 && (hopping || this.state === 'fight')) {
      const c = this.t * 9;
      cz = Math.abs(Math.sin(c)) * 24;
      cr = Math.sin(c * 0.5) * 0.3;
    }
    this.sprite.setPosition(px, py - this.z - jz - cz + 2)
      .setScale(this.baseScale * this.size * sx * this.face, this.baseScale * this.size * sy)
      .setRotation(this.rot + lean + cr)
      .setDepth(this.state === 'held' ? 500_000 : py);

    const dizzy = this.state === 'dizzy';
    if (dizzy) {
      // as estrelinhas só nascem na primeira vez que o soldado fica tonto
      this.stars ??= this.scene.add.text(0, 0, '★ ★ ★', { fontSize: '14px', color: '#f2b705' }).setOrigin(0.5);
      this.stars.setVisible(true).setPosition(px + Math.cos(this.t * 8) * 10, py - SOLDIER_H - 4).setDepth(500_001);
    } else if (this.stars?.visible) {
      this.stars.setVisible(false);
    }
    if (this.hp < this.maxHp && this.state !== 'held') {
      bars.draw(px, py - this.z - SOLDIER_H * this.size - 14, this.hp / this.maxHp, 30, 0x4cd137);
    }
  }
}
