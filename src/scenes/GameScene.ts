import Phaser from 'phaser';
import { CameraRig } from '../camera';
import { BAR_H, CLICK_AOE_MULT, CLICK_AOE_RADIUS, CLICK_DAMAGE, CLICK_DAMAGE_PER_CASTLE_LEVEL, COLORS, MAX_THROW_SPEED, SOLDIER_H, WORLD_H, WORLD_W } from '../config';
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
import { clearSave, loadGame, saveGame } from '../save';
import { addCoins, spend, state } from '../state';

export class GameScene extends Phaser.Scene {
  private castle!: Castle;
  private huts: Hut[] = [];
  private fx!: Particles;
  private ghost!: Phaser.GameObjects.Image;
  private placing: HutDef | null = null;
  private selected: Hut | Castle | null = null;
  private held: Soldier | null = null;
  private samples: { x: number; y: number; t: number }[] = [];
  private mouse = new Phaser.Math.Vector2();
  private incomeTimer = 0;
  private bars!: Bars;
  private rig!: CameraRig;
  private proj!: Projectiles;
  /** o primeiro chefe morreu: magos entram nas ondas */
  private magos = new URLSearchParams(location.search).has('magos');
  private orcs: Orc[] = [];
  private wave = 0;
  private waveTimer = -1;
  private over = false;
  /** com atalhos de teste na barra de endereço, não lê nem grava o progresso */
  private persist = !['onda', 'moedas', 'magos'].some(k => new URLSearchParams(location.search).has(k));
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
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H + BAR_H, 'grama')
      .setOrigin(0).setDepth(-1e6);

    this.fx = new Particles(this);

    // centro da cidade: no meio do mapa
    const tex = this.textures.get('castelo').getSourceImage();
    const ch = 420 * tex.height / tex.width;
    this.castle = new Castle(this, WORLD_W / 2, WORLD_H / 2 + ch / 2, this.fx);
    this.rig = new CameraRig(this);
    this.rig.centerOn(this.castle.x, this.castle.y - this.castle.h * 0.4);
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
    this.loadProgress();
    bus.emit(Evt.Coins, state.coins);
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.save() });
    const flush = () => this.save();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-ESC', () => this.stopPlacing());
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
  }

  /* ---------- salvar / carregar ---------- */

  private save() {
    if (!this.persist || this.over) return;
    saveGame({
      coins: Math.floor(state.coins),
      castleLevel: this.castle.level,
      wave: this.wave,
      magos: this.magos,
      huts: this.huts.map(h => ({ id: h.def.id, dx: Math.round(h.x - this.castle.x), dy: Math.round(h.y - this.castle.y), level: h.level })),
    });
  }

  private loadProgress() {
    if (!this.persist) return;
    const d = loadGame();
    if (!d) return;
    state.coins = d.coins;
    this.wave = d.wave;
    this.magos = this.magos || d.magos;
    this.castle.restore(d.castleLevel);
    for (const s of d.huts) {
      const x = Phaser.Math.Clamp(this.castle.x + s.dx, 110, WORLD_W - 110);
      const y = Phaser.Math.Clamp(this.castle.y + s.dy, 200, WORLD_H - 6);
      const hut = new Hut(this, hutDef(s.id), x, y, this.fx, h => this.onHutDestroyed(h));
      hut.restore(s.level);
      this.huts.push(hut);
    }
    if (this.huts.length > 0) this.waveTimer = 10;
    bus.emit(Evt.Hint, 'Bem-vindo de volta! Seu reino foi carregado.');
    this.time.delayedCall(4000, () => bus.emit(Evt.Hint, null));
  }

  private get allSoldiers() { return this.huts.flatMap(h => h.soldiers); }

  /* ---------- construir ---------- */

  private startPlacing(id: string) {
    const def = hutDef(id);
    if (def.maxCount && this.huts.filter(h => h.def === def).length >= def.maxCount) {
      bus.emit(Evt.Broke, id);
      bus.emit(Evt.Hint, `Limite de ${def.maxCount} construções: ${def.nome}`);
      this.time.delayedCall(2200, () => !this.placing && bus.emit(Evt.Hint, null));
      return;
    }
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
    if (b.y > WORLD_H - 6 || b.y - b.h < 70) return false;
    if (b.x - b.w / 2 < 0 || b.x + b.w / 2 > WORLD_W) return false;
    // não dá para construir por baixo da barra de construção
    if (this.rig.toScreen(b.x, b.y).y > this.scale.height - BAR_H - 4) return false;
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
    this.save();
    if (this.waveTimer < 0) this.waveTimer = this.debugWave ? 4 : WAVE.firstDelay;
    bus.emit(Evt.Hint, def.levels[0].soldiers.length ? 'Clique na cabana pra evoluir! Orcs vêm aí: arremesse os soldadinhos neles!' : 'A mina rende moedas! Mas ela não tem soldados: proteja-a!');
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
    this.emitSelPos();
  }

  /** O botão de upgrade é HTML: acompanha a câmera. */
  private emitSelPos() {
    const h = this.selected;
    if (!h) return;
    const p = this.rig.toScreen(h.x, h.y - h.h - 26);
    bus.emit(Evt.SelPos, p.x, p.y);
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
    this.save();
    this.emitSelect();
  }

  /* ---------- mouse ---------- */

  /** Inimigo vivo mais à frente sob o ponto (px, py). */
  private orcAt(px: number, py: number): Orc | null {
    let best: Orc | null = null;
    for (const o of this.orcs) {
      if (!o.alive) continue;
      const hgt = o.stats.height;
      if (Math.abs(px - o.x) < hgt * 0.38 && py < o.y + 6 && py > o.y - hgt && (!best || o.y > best.y)) best = o;
    }
    return best;
  }

  /** Clique que bate no inimigo e, mais fraco, em quem está pertinho. */
  private clickHit(o: Orc, x: number, y: number, touch: boolean) {
    const dmg = CLICK_DAMAGE + this.castle.level * CLICK_DAMAGE_PER_CASTLE_LEVEL;
    o.takeDamage(dmg, x, y);
    for (const other of this.orcs) {
      if (other === o || !other.alive) continue;
      // distância até o meio do corpo do outro inimigo
      if (Math.hypot(other.x - x, other.y - other.stats.height * 0.4 - y) < CLICK_AOE_RADIUS) {
        other.takeDamage(Math.max(1, Math.round(dmg * CLICK_AOE_MULT)), x, y);
      }
    }
    this.fx.burst(x, y, 7, 0xffe28a);
    const ring = this.add.ellipse(x, y, CLICK_AOE_RADIUS * 0.8, CLICK_AOE_RADIUS * 0.5)
      .setStrokeStyle(4, 0xfff0c0).setDepth(900_000);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    // no celular não existe cursor: a espada aparece dando o golpe
    if (touch) this.swordSwing(x, y);
  }

  /** Espada que desce cortando o ponto tocado (só quando o golpe acerta alguém). */
  private swordSwing(x: number, y: number) {
    const z = this.rig.zoom;
    const sword = this.add.image(x + 26 / z, y + 34 / z, 'espada')
      .setOrigin(0.5, 0.92).setDepth(900_001).setAlpha(0)
      .setScale(0.45 / z).setRotation(-1.15);
    // rastro branco do corte
    const slash = this.add.graphics().setDepth(900_000).setPosition(x, y).setAlpha(0);
    const r = 70 / z;
    slash.lineStyle(7 / z, 0xffffff, 0.9).beginPath().arc(0, 0, r, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(330)).strokePath();
    this.tweens.add({ targets: sword, alpha: 1, duration: 40 });
    this.tweens.add({
      targets: sword, rotation: 0.95, scale: 0.55 / z, duration: 150, ease: 'Cubic.easeIn',
      onComplete: () => {
        slash.setAlpha(1);
        this.tweens.add({ targets: slash, alpha: 0, scale: 1.25, duration: 220 });
        this.tweens.add({ targets: sword, alpha: 0, delay: 80, duration: 160, onComplete: () => { sword.destroy(); slash.destroy(); } });
      },
    });
  }

  private onDown(p: Phaser.Input.Pointer) {
    this.rig.setMouse(p.x, p.y);
    const wp = this.rig.toWorld(p.x, p.y);
    this.mouse.set(wp.x, wp.y);
    if (this.placing) {
      if (p.rightButtonDown()) this.stopPlacing(); else this.placeHut(this.placing);
      return;
    }
    // soldado mais da frente sob o mouse
    let best: Soldier | null = null;
    for (const s of this.allSoldiers) {
      if (s.state === 'dead') continue;
      if (s.hitDistance(wp.x, wp.y) < SOLDIER_H * 0.7 && (!best || s.y > best.y)) best = s;
    }
    if (best) {
      this.held = best;
      best.grab();
      this.samples = [{ x: wp.x, y: wp.y, t: performance.now() }];
      bus.emit(Evt.Hint, null);
      return;
    }
    // inimigo: o clique bate nele
    const foe = this.orcAt(wp.x, wp.y);
    if (foe) { this.clickHit(foe, wp.x, wp.y, p.wasTouch); return; }
    const hit: Hut | Castle | null = [...this.huts].reverse().find(h => h.contains(wp.x, wp.y))
      ?? (this.castle.contains(wp.x, wp.y) ? this.castle : null);
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
    this.save();
    if (this.selected) this.emitSelect();
    const boss = this.wave % BOSS_EVERY === 0;
    const n = WAVE.count(this.wave);
    const W = WORLD_W, floor = WORLD_H;
    for (let i = 0; i < n; i++) {
      // entram pelas bordas do mapa: em cima, à esquerda ou à direita
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
      bus.emit(Evt.Hint, `Onda ${this.wave}! ${n} orcs a caminho!` + (this.wave === 1 ? ' Clique neles para bater!' : ''));
    }
    this.time.delayedCall(4500, () => bus.emit(Evt.Hint, null));
  }

  private onHutDestroyed(h: Hut) {
    this.huts = this.huts.filter(x => x !== h);
    this.save();
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
    // acabou: a próxima partida começa do zero
    if (this.persist) clearSave();
    this.held = null;
    bus.emit(Evt.GameOver);
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.over) return;

    // câmera: zoom, bordas e teclas; o mouse passa a valer em coordenadas do mapa
    this.rig.update(dt);
    const mw = this.rig.mouseWorld();
    this.mouse.set(mw.x, mw.y);
    if (this.held) {
      this.samples.push({ x: mw.x, y: mw.y, t: performance.now() });
      if (this.samples.length > 8) this.samples.shift();
    }
    this.emitSelPos();

    // renda do centro da cidade (até as minas existirem)
    this.incomeTimer += dt;
    if (this.incomeTimer >= 1) {
      this.incomeTimer -= 1;
      addCoins(this.castle.income);
      floatText(this, this.castle.x + (Math.random() - 0.5) * 60, this.castle.y - this.castle.h * 0.6, '+' + this.castle.income);
      let total = this.castle.income;
      // cada mina rende e mostra a moedinha subindo
      for (const h of this.huts) {
        const inc = h.income;
        if (inc <= 0) continue;
        total += inc;
        addCoins(inc);
        floatText(this, h.x + (Math.random() - 0.5) * 30, h.y - h.h * 0.8, '+' + inc);
      }
      bus.emit(Evt.Income, total);
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

    const floor = WORLD_H;
    this.bars.begin();
    const soldiers = this.allSoldiers;
    const alive = this.orcs.filter(o => o.alive);
    for (const s of soldiers) s.update(dt, this.mouse, WORLD_W, floor, alive, this.bars);
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
