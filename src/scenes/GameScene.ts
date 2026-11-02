import Phaser from 'phaser';
import { BAR_H, COLORS, MAX_THROW_SPEED, SOLDIER_H } from '../config';
import { bus, Evt, SelectInfo } from '../events';
import { Building, overlaps, Structure } from '../entities/Building';
import { Castle } from '../entities/Castle';
import { Hut } from '../entities/Hut';
import { Orc } from '../entities/Orc';
import { Projectiles } from '../entities/Projectile';
import { Soldier } from '../entities/Soldier';
import { HutDef, hutDef } from '../data/cabanas';
import { BOSS_EVERY, pickOrcKind, WAVE } from '../data/units';
import { Bars, floatText, Particles } from '../fx';
import { addCoins, spend, state } from '../state';

export class GameScene extends Phaser.Scene {
  private castle!: Castle;
  private huts: Hut[] = [];
  private fx!: Particles;
  private bg!: Phaser.GameObjects.TileSprite;
  private ghost!: Phaser.GameObjects.Image;
  private placing: HutDef | null = null;
  private selected: Hut | Castle | null = null;
  private held: Soldier | null = null;
  private samples: { x: number; y: number; t: number }[] = [];
  private mouse = new Phaser.Math.Vector2();
  private incomeTimer = 0;
  private bars!: Bars;
  private proj!: Projectiles;
  /** o primeiro chefe morreu: magos entram nas ondas */
  private magos = new URLSearchParams(location.search).has('magos');
  private orcs: Orc[] = [];
  private wave = 0;
  private waveTimer = -1;
  private over = false;
  /** atalho de teste: ?onda=5 começa na onda 5 */
  private debugWave = Number(new URLSearchParams(location.search).get('onda')) || 0;

  constructor() { super('Game'); }

  create() {
    if (this.debugWave > 0) this.wave = this.debugWave - 1;
    // chão quadriculado
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.grass).fillRect(0, 0, 160, 160);
    g.fillStyle(COLORS.grassTile, 0.5).fillRect(0, 0, 80, 80).fillRect(80, 80, 80, 80);
    g.generateTexture('grama', 160, 160);
    g.destroy();
    this.bg = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'grama')
      .setOrigin(0).setDepth(-1e6);
    this.scale.on('resize', (s: Phaser.Structs.Size) => this.bg.setSize(s.width, s.height));

    this.fx = new Particles(this);

    // centro da cidade: já começa no meio da área jogável
    const tex = this.textures.get('castelo').getSourceImage();
    const ch = 420 * tex.height / tex.width;
    this.castle = new Castle(this, this.scale.width / 2, (this.scale.height - BAR_H) / 2 + ch / 2, this.fx);
    this.bars = new Bars(this);
    this.proj = new Projectiles(this, this.fx);

    this.ghost = this.add.image(0, 0, 'cabana_soldado_1').setOrigin(0.5, 1)
      .setAlpha(0.85).setVisible(false).setDepth(900_000);

    bus.on(Evt.Build, this.startPlacing, this);
    bus.on(Evt.Upgrade, this.upgradeSelected, this);
    this.events.once('shutdown', () => {
      bus.off(Evt.Build, this.startPlacing, this);
      bus.off(Evt.Upgrade, this.upgradeSelected, this);
    });
    bus.emit(Evt.Coins, state.coins);

    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-ESC', () => this.stopPlacing());
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.mouse.set(p.x, p.y);
      if (this.held) {
        this.samples.push({ x: p.x, y: p.y, t: performance.now() });
        if (this.samples.length > 8) this.samples.shift();
      }
    });
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
  }

  private get allSoldiers() { return this.huts.flatMap(h => h.soldiers); }

  /* ---------- construir ---------- */

  private startPlacing(id: string) {
    const def = hutDef(id);
    if (this.placing === def) { this.stopPlacing(); return; }
    if (state.coins < def.levels[0].cost) {
      bus.emit(Evt.Broke, id);
      bus.emit(Evt.Hint, 'Faltam moedas!');
      this.time.delayedCall(1800, () => !this.placing && bus.emit(Evt.Hint, null));
      return;
    }
    this.held = null;
    this.select(null);
    this.placing = def;
    const lv = def.levels[0];
    const tex = this.textures.get(lv.art).getSourceImage();
    this.ghost.setTexture(lv.art).setDisplaySize(lv.width, lv.width * tex.height / tex.width).setVisible(true);
    bus.emit(Evt.Placing, id);
    bus.emit(Evt.Hint, 'Clique no mapa para construir (Esc ou botão direito cancela)');
  }

  private stopPlacing() {
    if (!this.placing) return;
    this.placing = null;
    this.ghost.setVisible(false);
    bus.emit(Evt.Placing, null);
    bus.emit(Evt.Hint, null);
  }

  /** Base da cabana em (x, y) quando o mouse está em (x, y) = centro dela. */
  private ghostBuilding(): Building {
    const w = this.ghost.displayWidth, h = this.ghost.displayHeight;
    return { x: this.mouse.x, y: this.mouse.y + h / 2, w, h };
  }

  private canPlace(b: Building) {
    if (b.y > this.scale.height - BAR_H - 4 || b.y - b.h < 70) return false;
    if (b.x - b.w / 2 < 0 || b.x + b.w / 2 > this.scale.width) return false;
    if (overlaps(b, this.castle)) return false;
    return !this.huts.some(h => overlaps(b, h));
  }

  private placeHut(def: HutDef) {
    const b = this.ghostBuilding();
    if (!this.canPlace(b)) { bus.emit(Evt.Hint, 'Aqui não cabe!'); return; }
    if (!spend(def.levels[0].cost)) return;
    const hut = new Hut(this, def, b.x, b.y, this.fx, h => this.onHutDestroyed(h));
    this.huts.push(hut);
    this.fx.burst(b.x, b.y, 24, 0xe8d9b8, true);
    this.stopPlacing();
    this.select(hut);
    if (this.waveTimer < 0) this.waveTimer = this.debugWave ? 4 : WAVE.firstDelay;
    bus.emit(Evt.Hint, 'Clique na cabana pra evoluir! Orcs vêm aí: arremesse os soldadinhos neles!');
    this.time.delayedCall(5000, () => bus.emit(Evt.Hint, null));
  }

  /* ---------- selecionar / evoluir ---------- */

  private select(item: Hut | Castle | null) {
    this.selected?.setSelected(false);
    this.selected = item;
    item?.setSelected(true);
    this.emitSelect();
  }

  private emitSelect() {
    const h = this.selected;
    if (!h) { bus.emit(Evt.Select, null); return; }
    const nx = h.next;
    // cabana: o próximo nível só abre se o centro da vila deixar
    let lock: string | undefined;
    if (h instanceof Hut && nx && h.level + 2 > this.castle.hutMax) lock = `Centro Nv ${this.castle.level + 2}`;
    // o centro da vila também espera você chegar a uma onda
    if (h instanceof Castle && h.next && this.wave < h.next.minWave) lock = `Onda ${h.next.minWave}`;
    const info: SelectInfo = {
      x: h.x, y: h.y - h.h - 26,
      next: nx ? { art: nx.art, cost: nx.cost, lock } : null,
    };
    bus.emit(Evt.Select, info);
  }

  private upgradeSelected() {
    const h = this.selected, nx = h?.next;
    if (!h || !nx) return;
    if (h instanceof Hut && h.level + 2 > this.castle.hutMax) {
      bus.emit(Evt.Broke, 'upgrade');
      bus.emit(Evt.Hint, 'Evolua o Centro da Vila para liberar cabanas de nível ' + (h.level + 2) + '!');
      this.time.delayedCall(3000, () => bus.emit(Evt.Hint, null));
      return;
    }
    if (h instanceof Castle && this.wave < (h.next?.minWave ?? 0)) {
      bus.emit(Evt.Broke, 'upgrade');
      bus.emit(Evt.Hint, `Sobreviva até a onda ${h.next?.minWave} para evoluir o Centro da Vila!`);
      this.time.delayedCall(3000, () => bus.emit(Evt.Hint, null));
      return;
    }
    if (!spend(nx.cost)) { bus.emit(Evt.Broke, 'upgrade'); return; }
    h.upgrade();
    floatText(this, h.x, h.y - h.h - 10, 'EVOLUIU!', '#7CFF6B');
    this.emitSelect();
  }

  /* ---------- mouse ---------- */

  private onDown(p: Phaser.Input.Pointer) {
    this.mouse.set(p.x, p.y);
    if (this.placing) {
      if (p.rightButtonDown()) this.stopPlacing(); else this.placeHut(this.placing);
      return;
    }
    // soldado mais da frente sob o mouse
    let best: Soldier | null = null;
    for (const s of this.allSoldiers) {
      if (s.state === 'dead') continue;
      if (s.hitDistance(p.x, p.y) < SOLDIER_H * 0.7 && (!best || s.y > best.y)) best = s;
    }
    if (best) {
      this.held = best;
      best.grab();
      this.samples = [{ x: p.x, y: p.y, t: performance.now() }];
      bus.emit(Evt.Hint, null);
      return;
    }
    const hit: Hut | Castle | null = [...this.huts].reverse().find(h => h.contains(p.x, p.y))
      ?? (this.castle.contains(p.x, p.y) ? this.castle : null);
    this.select(hit === this.selected ? null : hit);
  }

  private onUp() {
    const s = this.held;
    if (!s) return;
    this.held = null;
    const now = performance.now();
    const rec = this.samples.filter(q => now - q.t < 120);
    let vx = 0, vy = 0;
    if (rec.length >= 2) {
      const a = rec[0], b = rec[rec.length - 1], dt = Math.max((b.t - a.t) / 1000, 0.016);
      vx = (b.x - a.x) / dt;
      vy = (b.y - a.y) / dt;
    }
    const sp = Math.hypot(vx, vy);
    if (sp > MAX_THROW_SPEED) { vx *= MAX_THROW_SPEED / sp; vy *= MAX_THROW_SPEED / sp; }
    s.throwWith(vx, vy);
  }

  /* ---------- loop ---------- */

  /* ---------- ondas de orcs ---------- */

  private spawnWave() {
    this.wave++;
    if (this.selected) this.emitSelect();
    const boss = this.wave % BOSS_EVERY === 0;
    const n = WAVE.count(this.wave);
    const W = this.scale.width, floor = this.scale.height - BAR_H;
    for (let i = 0; i < n; i++) {
      // entram por cima, esquerda ou direita
      const side = Phaser.Math.Between(0, 2);
      const x = side === 0 ? Phaser.Math.Between(40, W - 40) : side === 1 ? -50 : W + 50;
      const y = side === 0 ? 40 : Phaser.Math.Between(120, floor - 40);
      this.time.delayedCall(i * 450, () => {
        if (this.over) return;
        const kind = pickOrcKind(this.wave, this.magos);
        this.orcs.push(new Orc(this, x, y, kind, this.wave, this.fx, o => this.onOrcDie(o)));
      });
    }
    if (boss) {
      this.orcs.push(new Orc(this, W / 2, 20, 'boss', this.wave, this.fx, o => this.onOrcDie(o)));
      this.cameras.main.shake(600, 0.01);
      bus.emit(Evt.Hint, `CUIDADO! Onda ${this.wave}: o Rei Orc chegou!`);
    } else {
      bus.emit(Evt.Hint, `Onda ${this.wave}! ${n} orcs a caminho!`);
    }
    this.time.delayedCall(4500, () => bus.emit(Evt.Hint, null));
  }

  private onHutDestroyed(h: Hut) {
    this.huts = this.huts.filter(x => x !== h);
    if (this.selected === h) { this.selected = null; this.emitSelect(); }
    floatText(this, h.x, h.y - h.h * 0.6, 'Cabana destruída!', '#ff5a4d');
    this.cameras.main.shake(180, 0.004);
  }

  private onOrcDie(o: Orc) {
    if (o.stats.boss && !this.magos) {
      this.magos = true;
      bus.emit(Evt.Hint, 'O Rei Orc caiu! Mas magos sombrios estão chegando...');
      this.time.delayedCall(5000, () => bus.emit(Evt.Hint, null));
    }
    addCoins(o.stats.coins);
    floatText(this, o.x, o.y - o.stats.height - 30, '+' + o.stats.coins);
  }

  private lose() {
    this.over = true;
    this.held = null;
    bus.emit(Evt.GameOver);
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.over) return;

    // renda do centro da cidade (até as minas existirem)
    this.incomeTimer += dt;
    if (this.incomeTimer >= 1) {
      this.incomeTimer -= 1;
      addCoins(this.castle.income);
      floatText(this, this.castle.x + (Math.random() - 0.5) * 60, this.castle.y - this.castle.h * 0.6, '+' + this.castle.income);
    }

    if (this.placing) {
      const b = this.ghostBuilding();
      const ok = this.canPlace(b);
      const bob = Math.abs(Math.sin(time / 1000 * 9)) * 10;
      const base = this.placing.levels[0].width / this.ghost.width;
      this.ghost.setPosition(b.x, b.y - bob)
        .setScale(base * (1 + bob * 0.004), base * (1 - bob * 0.004))
        .setRotation(Math.sin(time / 1000 * 5) * 0.04);
      if (ok) this.ghost.clearTint(); else this.ghost.setTint(0xff7070);
    }

    // ondas
    if (this.waveTimer >= 0) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) { this.spawnWave(); this.waveTimer = WAVE.interval; }
    }

    const floor = this.scale.height - BAR_H;
    this.bars.begin();
    const soldiers = this.allSoldiers;
    const alive = this.orcs.filter(o => o.alive);
    for (const s of soldiers) s.update(dt, this.mouse, this.scale.width, floor, alive, this.bars);
    const structures: Structure[] = [this.castle, ...this.huts];
    for (const o of this.orcs) o.update(dt, soldiers, structures, this.bars, this.proj);
    this.orcs = this.orcs.filter(o => !o.gone);
    // esqueletos invocados pelos magos
    const born: Orc[] = [];
    for (const o of this.orcs) {
      for (const m of o.takeSummons()) {
        const minion = new Orc(this, m.x, m.y, m.kind, this.wave, this.fx, x => this.onOrcDie(x));
        o.adopt(minion);
        born.push(minion);
      }
    }
    this.orcs.push(...born);

    // soldado arremessado bate nos orcs com o corpo todo
    for (const s of soldiers) {
      if (s.state !== 'fly' || s.z > 50 || s.hitCd > 0) continue;
      for (const o of alive) {
        if (o.alive && Math.hypot(o.x - s.x, o.y - s.y) < 40) {
          o.takeDamage(Math.max(6, Math.round(s.speed * 0.03)), s.x, s.y);
          s.hitCd = 0.3;
          break;
        }
      }
    }

    // o castelo se cura devagar quando está tudo calmo
    if (alive.length === 0 && this.castle.hp < this.castle.maxHp) {
      this.castle.hp = Math.min(this.castle.maxHp, this.castle.hp + 6 * dt);
      for (const h of this.huts) h.heal(4 * dt);
    }
    this.castle.drawBar(this.bars);
    for (const h of this.huts) h.drawBar(this.bars);
    if (!this.castle.alive) this.lose();

    this.proj.update(dt);
    this.fx.update(dt);
  }
}
