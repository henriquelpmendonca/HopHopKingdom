import Phaser from 'phaser';
import { sfx } from '../audio';
import { ORCS, OrcKind, OrcStats, orcForWave } from '../data/units';
import { Bars, Particles, popDamage } from '../fx';
import { Structure } from './Building';
import { Combatant } from './Combatant';
import { Projectiles } from './Projectile';
import { Soldier } from './Soldier';

const ATTACK_TIME = 0.35;

export class Orc implements Combatant {
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  private dmg: number;
  readonly stats: OrcStats;
  private speed: number;
  private target: Combatant | null = null;
  private retargetT = 0;
  private cdT = 0.5;
  private atkT = 0;
  private atkHit = false;
  private hitT = 0;
  private rx = 0;
  private ry = 0;
  private phase = Math.random() * 6;
  private face = 1;
  private deadT = -1;
  private age = 0;
  /** invocações: o que o mago invocou e o que está esperando para nascer */
  private minions: Orc[] = [];
  private pending: { kind: OrcKind; x: number; y: number }[] = [];
  private summonT = Infinity;
  /** segundos de gelo que faltam (parado, sem atacar) */
  private frozen = 0;
  /** segundos em que ainda não pode ser congelado de novo */
  private freezeImmune = 0;
  /** queimadura: dano por segundo e quanto tempo falta */
  private burnDps = 0;
  private burnT = 0;
  private burnTick = 0;
  private ox = 0;
  private oy = 0;

  private sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private baseScale: number;

  /** onDie é chamado uma vez, quando o orc morre */
  constructor(private scene: Phaser.Scene, x: number, y: number, readonly kind: OrcKind, wave: number, private fx: Particles, private onDie: (o: Orc) => void) {
    this.stats = ORCS[kind];
    if (this.stats.summon) this.summonT = this.stats.summon.every * 0.4;
    const st = orcForWave(kind, wave);
    this.hp = this.maxHp = st.hp;
    this.dmg = st.dmg;
    this.speed = st.speed * (0.9 + Math.random() * 0.2);
    this.x = x;
    this.y = y;
    const tex = scene.textures.get(this.stats.art).getSourceImage();
    this.baseScale = this.stats.height / tex.height;
    const w = tex.width * this.baseScale;
    this.shadow = scene.add.image(x, y, 'soft').setTint(0x000000).setAlpha(0.32).setScale(w * 0.95 / 64, w * 0.3 / 64);
    this.sprite = scene.add.image(x, y, this.stats.art).setOrigin(0.5, 1).setScale(this.baseScale);
  }

  get alive() { return this.hp > 0; }

  /** está batendo numa construção agora (o radar destaca esses) */
  get hittingBuilding() { return !!this.target && 'nearestPoint' in this.target; }

  /** Entrega os esqueletos que o mago acabou de invocar (a cena cria eles). */
  takeSummons() {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  adopt(m: Orc) { this.minions.push(m); }

  /** Bola de fogo: o inimigo pega fogo e leva dano por alguns segundos. */
  ignite(dps: number, sec: number) {
    if (!this.alive) return;
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnT = Math.max(this.burnT, sec);
    this.burnTick = Math.min(this.burnTick, 0.5);
    if (this.frozen <= 0) this.sprite.setTint(0xffa060);
  }

  /**
   * Congelar: fica parado e azulado. Para ninguém ficar preso para sempre (várias bolas de gelo seguidas renovavam o
   * gelo antes de ele acabar), depois de congelado o inimigo fica um tempo sem poder congelar de novo: um pouco
   * para os comuns e bastante para os chefes, que também congelam por bem menos tempo. O poder do jogador
   * (`manual`) ignora essa pausa e congela o chefe por até 2,5 s.
   */
  freeze(sec: number, manual = false) {
    if (!this.alive) return;
    const boss = !!this.stats.boss;
    if (!manual && this.freezeImmune > 0) return;
    const dur = boss ? Math.min(sec * (manual ? 0.5 : 0.35), manual ? 2.5 : 0.8) : sec;
    this.frozen = Math.max(this.frozen, dur);
    this.freezeImmune = Math.max(this.freezeImmune, dur + (boss ? 8 : 2));
    this.sprite.setTint(0x9fd8ff);
    this.fx.burst(this.x, this.y - this.stats.height * 0.5, 8, 0xbfe9ff);
  }

  /** Some na hora, sem recompensa nem efeito (cidade reerguida). */
  vanish() {
    this.hp = 0;
    this.deadT = 99;
    this.sprite.destroy();
    this.shadow.destroy();
  }

  private trySummon(dt: number) {
    const sm = this.stats.summon;
    if (!sm || !this.target) return;
    this.summonT -= dt;
    if (this.summonT > 0) return;
    this.minions = this.minions.filter(m => m.alive);
    if (this.minions.length >= sm.max) { this.summonT = 1; return; }
    for (let i = 0; i < sm.count; i++) {
      this.pending.push({
        kind: sm.kind,
        x: this.x + (i - (sm.count - 1) / 2) * 56 + (Math.random() - 0.5) * 16,
        y: this.y + 16 + Math.random() * 14,
      });
    }
    this.fx.burst(this.x, this.y - this.stats.height * 0.6, 20, 0xb04cff, true);
    sfx.summon();
    this.fx.burst(this.x, this.y, 10, 0xf6dcff);
    this.summonT = sm.every;
  }
  get gone() { return this.deadT >= 1; }

  /** orc dourado: direção da corrida e quanto tempo ainda fica na tela */
  private run: { dx: number; dy: number; life: number } | null = null;
  runAway(dx: number, dy: number, life: number) { const d = Math.hypot(dx, dy) || 1; this.run = { dx: dx / d, dy: dy / d, life }; this.face = dx >= 0 ? 1 : -1; }

  takeDamage(n: number, fromX: number, fromY: number, fromFire = false) {
    if (!this.alive) return;
    // orc dourado: cai com 3 golpes, seja qual for a espada
    if (this.stats.runner) n = Math.max(n, Math.ceil(this.maxHp / 3));
    this.hp = Math.max(0, this.hp - n);
    this.hitT = 0.2;
    popDamage(this.scene, this.x, this.y - this.stats.height - 6, n, false);
    if (fromFire) {
      // queimadura: faíscas de fogo, sem sangue
      this.fx.burst(this.x, this.y - this.stats.height * 0.5, 3, 0xff8a2a);
    } else {
      sfx.hit(!!this.stats.boss || n >= 30);
      this.fx.burst(this.x, this.y - this.stats.height * 0.5, 5, 0xffffff);
      this.fx.blood(this.x, this.y - this.stats.height * 0.55, this.y, Math.min(40, 4 + n * 0.5) * (this.stats.boss ? 1.6 : 1));
    }
    const d = Math.hypot(this.x - fromX, this.y - fromY) || 1;
    this.rx = (this.x - fromX) / d * 16;
    this.ry = (this.y - fromY) / d * 8;
    if (this.hp <= 0) {
      this.deadT = 0;
      sfx.orcDie(!!this.stats.boss);
      this.fx.burst(this.x, this.y - this.stats.height * 0.5, 18, 0x9bb84a, true);
      // nuvem de poeira e estrelinhas: a derrota do orc fica bem visível
      const h = this.stats.height;
      const hasDust = this.scene.textures.exists('fx_dust');
      const puff = this.scene.add.image(this.x, this.y - h * 0.45, hasDust ? 'fx_dust' : 'soft').setAlpha(0.95).setDepth(this.y + 5);
      if (!hasDust) puff.setTint(0xf4ecd8);
      const ps = h * 1.3 / Math.max(puff.width, puff.height);
      puff.setScale(ps * 0.3);
      this.scene.tweens.add({ targets: puff, scale: ps, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => puff.destroy() });
      this.fx.burst(this.x, this.y - h * 0.7, 10, 0xffe45a, true);
      this.fx.blood(this.x, this.y - this.stats.height * 0.5, this.y, this.stats.boss ? 90 : 26);
      if (this.stats.boss) this.scene.cameras.main.shake(500, 0.012);
      this.onDie(this);
    }
  }

  private pickTarget(soldiers: Soldier[], structures: Structure[]) {
    let best: Soldier | null = null, bd = 230;
    for (const s of soldiers) {
      if (!s.attackable) continue;
      const d = Math.hypot(s.x - this.x, s.y - this.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) { this.target = best; return; }
    // sem soldados por perto: a construção mais próxima (castelo ou cabana)
    let near: Structure | null = null, nd = Infinity;
    for (const st of structures) {
      if (!st.alive) continue;
      const p = st.nearestPoint(this.x, this.y);
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < nd) { nd = d; near = st; }
    }
    this.target = near;
  }

  update(dt: number, soldiers: Soldier[], structures: Structure[], bars: Bars, proj: Projectiles) {
    if (this.deadT >= 0) {
      this.deadT += dt * 2.2;
      const k = Math.max(0, 1 - this.deadT);
      this.sprite.setScale(this.baseScale * (1 + this.deadT * 0.4) * this.face, this.baseScale * k).setAlpha(k);
      this.shadow.setAlpha(0.32 * k);
      if (this.gone) { this.sprite.destroy(); this.shadow.destroy(); }
      return;
    }

    this.age += dt;
    this.freezeImmune = Math.max(0, this.freezeImmune - dt);
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = 0.5;
        this.takeDamage(Math.max(1, Math.round(this.burnDps * 0.5)), this.x, this.y, true);
        if (!this.alive) return;
      }
      if (this.burnT <= 0) { this.burnDps = 0; if (this.frozen <= 0) this.sprite.clearTint(); }
    }
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) { if (this.burnT > 0) this.sprite.setTint(0xffa060); else this.sprite.clearTint(); }
      this.render(bars);
      return;
    }
    // orc dourado: só corre (com zigue-zague) e, se ninguém pegar, some sem dar nada
    if (this.run) {
      this.run.life -= dt;
      this.phase += dt * 11;
      this.x += (this.run.dx * this.speed + Math.sin(this.age * 5) * 40 * -this.run.dy) * dt;
      this.y += (this.run.dy * this.speed * 0.7 + Math.sin(this.age * 5) * 40 * this.run.dx) * dt;
      if (Math.random() < dt * 6) this.fx.burst(this.x, this.y - this.stats.height * 0.5, 1, 0xffe45a);
      if (this.run.life <= 0) { this.hp = 0; this.deadT = 0; }
      this.render(bars);
      return;
    }
    this.cdT -= dt;
    this.trySummon(dt);
    this.hitT = Math.max(0, this.hitT - dt);
    this.rx *= Math.pow(0.001, dt);
    this.ry *= Math.pow(0.001, dt);

    this.retargetT -= dt;
    const t = this.target;
    if (this.retargetT <= 0 || !t || !t.alive || (t instanceof Soldier && !t.attackable)) {
      this.retargetT = 0.4;
      this.pickTarget(soldiers, structures);
    }

    // onde ele quer chegar
    const tg = this.target;
    let tx = this.x, ty = this.y;
    if (tg) {
      if ('nearestPoint' in tg) { const p = (tg as Structure).nearestPoint(this.x, this.y); tx = p.x; ty = p.y; }
      else { tx = tg.x; ty = tg.y; }
    }
    const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy);
    const ranged = this.stats.ranged;
    // mago para a distância e atira; os outros chegam colados
    const reach = ranged ? ranged.range * 0.92 : tg && 'nearestPoint' in tg ? this.stats.reach - 6 : this.stats.reach;

    if (this.atkT > 0) {
      const prev = this.atkT;
      this.atkT += dt / ATTACK_TIME;
      const p = this.atkT;
      if (prev < 0.5 && p >= 0.5 && !this.atkHit && tg) {
        this.atkHit = true;
        if (ranged?.spell === 'strike') this.castStrike(tg, soldiers, structures, proj);
        else if (ranged) this.shoot(tg, proj);
        else {
          tg.takeDamage(this.dmg, this.x, this.y);
          if (this.stats.aoe) this.slam(tg, soldiers);
        }
      }
      // investida com o corpo todo
      const lunge = ranged ? 0 : Math.sin(Math.min(1, p) * Math.PI) * 26;
      const d = dist || 1;
      this.ox = dx / d * lunge;
      this.oy = dy / d * lunge * 0.6;
      if (p >= 1) { this.atkT = 0; this.ox = this.oy = 0; }
    } else if (tg && dist > reach) {
      this.phase += dt * 7;
      this.x += dx / dist * this.speed * dt;
      this.y += dy / dist * this.speed * dt;
      if (Math.abs(dx) > 4) this.face = dx >= 0 ? 1 : -1;
    } else if (tg && this.cdT <= 0) {
      this.cdT = this.stats.cd;
      this.atkT = 0.001;
      this.atkHit = false;
    }

    this.render(bars);
  }

  /** Mago nível 2: marca o chão sob o alvo; um raio sombrio cai em área logo depois. */
  private castStrike(tg: Combatant, soldiers: Soldier[], structures: Structure[], proj: Projectiles) {
    const r = this.stats.ranged!;
    const radius = r.radius ?? 100;
    sfx.strikeCharge(r.delay ?? 1);
    const p = 'nearestPoint' in tg ? (tg as Structure).nearestPoint(this.x, this.y) : { x: tg.x, y: tg.y };
    const teal = r.tone === 'teal';
    this.fx.burst(this.x + this.face * 22, this.y - this.stats.height * 0.62, teal ? 18 : 10, teal ? 0x22e0f0 : 0xd070ff);
    const impact = (x: number, y: number, rad: number) => {
      for (const s of soldiers) {
        if (s.attackable && Math.hypot(s.x - x, (s.y - y) * 2) < rad) s.takeDamage(this.dmg, x, y);
      }
      for (const st of structures) {
        const q = st.nearestPoint(x, y);
        if (st.alive && Math.hypot(q.x - x, (q.y - y) * 2) < rad) st.takeDamage(Math.round(this.dmg * 0.7), x, y);
      }
    };
    // chefe: salva de 3 raios (o alvo e mais dois por perto, um depois do outro)
    const spots = this.stats.boss
      ? [p, { x: p.x + 150 + Math.random() * 90, y: p.y + (Math.random() - 0.5) * 120 }, { x: p.x - 150 - Math.random() * 90, y: p.y + (Math.random() - 0.5) * 120 }]
      : [p];
    spots.forEach((q, i) => proj.strike(q.x, q.y, radius, (r.delay ?? 1) + i * 0.22, impact, teal ? 'teal' : false));
  }

  /** Mago: solta uma bola de magia roxa em direção ao alvo. */
  private shoot(tg: Combatant, proj: Projectiles) {
    const r = this.stats.ranged!;
    sfx.magic();
    let aim: () => { x: number; y: number };
    if ('nearestPoint' in tg) {
      const p = (tg as Structure).nearestPoint(this.x, this.y);
      aim = () => p;
    } else {
      aim = () => ({ x: tg.x, y: tg.y - 24 });
    }
    proj.fire(this.x + this.face * 22, this.y - this.stats.height * 0.62, tg, aim, this.dmg, r.projSpeed, r.size ?? 1);
  }

  /** Pancada do chefe: o chão treme e quem estiver em volta também apanha. */
  private slam(tg: Combatant, soldiers: Soldier[]) {
    const { radius, mult } = this.stats.aoe!;
    const cx = tg.x, cy = tg.y;
    for (const s of soldiers) {
      if (s !== tg && s.attackable && Math.hypot(s.x - cx, s.y - cy) < radius) {
        s.takeDamage(Math.round(this.dmg * mult), cx, cy);
      }
    }
    this.scene.cameras.main.shake(160, 0.007);
    sfx.slam();
    this.fx.burst(cx, cy, 14, 0xd9c9a0, true);
    const ring = this.scene.add.ellipse(cx, cy, radius * 0.4, radius * 0.2).setStrokeStyle(6, 0xfff0c0).setDepth(900_000);
    this.scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  }

  private render(bars: Bars) {
    const walking = this.atkT === 0 && this.target !== null;
    const bob = walking ? Math.abs(Math.sin(this.phase)) * 5 : 0;
    const x = this.x + this.ox + this.rx, y = this.y + this.oy + this.ry;
    // nasce crescendo (invocados e recém-chegados)
    const g = 1 - Math.pow(1 - Math.min(1, this.age / 0.35), 2);
    // machucado: achata e estica rapidinho
    const hit = this.hitT > 0 ? 1 + Math.sin(this.hitT / 0.2 * Math.PI) * 0.2 : 1;
    const wind = this.atkT > 0 && this.atkT < 0.3 ? (this.stats.ranged ? 0.9 : 1.1) : 1;
    this.shadow.setPosition(x, y).setDepth(y - 1);
    this.sprite.setPosition(x, y - bob)
      .setScale(this.baseScale * g * this.face * (2 - hit) * wind, this.baseScale * g * hit)
      .setRotation(walking ? Math.sin(this.phase) * 0.08 : 0)
      .setDepth(y);
    if (this.hp < this.maxHp) bars.draw(x, y - this.stats.height - 16, this.hp / this.maxHp, this.stats.boss ? 130 : 46, 0xff5a4d);
  }
}
