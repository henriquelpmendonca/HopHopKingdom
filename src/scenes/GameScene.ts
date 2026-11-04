import Phaser from 'phaser';
import { audio, sfx } from '../audio';
import { t } from '../i18n';
import { sdk } from '../sdk';
import { CameraRig } from '../camera';
import { Radar } from '../ui/Radar';
import { barH, CLICK_AOE_MULT, KILL_COIN_MULT, REBUILD_COIN_KEEP, REBUILD_HUT_WAVES, rebuildBack, SELL_REFUND, MOVE_COST, COLORS, MAX_THROW_SPEED, SOLDIER_H, WORLD_H, WORLD_W } from '../config';
import { bus, Evt, SelectInfo } from '../events';
import { Building, overlaps, Structure } from '../entities/Building';
import { Castle } from '../entities/Castle';
import { Hut } from '../entities/Hut';
import { Orc } from '../entities/Orc';
import { Projectiles } from '../entities/Projectile';
import { Soldier } from '../entities/Soldier';
import { BUILDABLES, buildCost, HutDef, hutDef } from '../data/cabanas';
import { SWORD_MAX, swordCost, swordDamage, swordRadius, swordTier } from '../data/sword';
import { isBossWave, pickOrcKind, WAVE } from '../data/units';
import { Bars, floatText, Particles } from '../fx';
import { loadGame, saveGame } from '../save';
import { addCoins, addMana, spend, spendMana, state, tuto } from '../state';
import { store } from '../store';
import { addStars, noteKill, perkMult, setMetaEnabled, startBonus, STARS_BOSS_KILL, STARS_RECORD_BOSS_WAVE, STARS_RECORD_WAVE } from '../meta';
import { CASTLE_LEVELS, MAGIC_CASTLE_LEVEL } from '../data/castle';
import type { Key } from '../i18n';
import { CASTLE_MANA_INCOME, MANA_GIFT, meteorDamage, POWER_FREEZE_SECONDS, POWER_METEOR_COUNT, POWERS } from '../data/powers';

/** quantos orcs seguidos mostram um aviso de combo */
const COMBO_AT = [3, 5, 8, 12, 16, 20, 25, 30];

export class GameScene extends Phaser.Scene {
  private castle!: Castle;
  private huts: Hut[] = [];
  private fx!: Particles;
  private ghost!: Phaser.GameObjects.Image;
  private placing: HutDef | null = null;
  /** cabana levantada para mudar de lugar: se desistir, volta para onde estava */
  private moving: { def: HutDef; level: number; x: number; y: number; cost: number } | null = null;
  /** desenho (e largura) da cabana no cursor: o nível 1 ao construir, o nível dela ao mover */
  private ghostLv: { art: string; width: number } | null = null;
  private calmShown = true;
  private selected: Hut | Castle | null = null;
  private held: Soldier | null = null;
  private samples: { x: number; y: number; t: number }[] = [];
  private mouse = new Phaser.Math.Vector2();
  private incomeTimer = 0;
  /** quando (ms) cada poder volta a poder ser usado */
  private powerReady: Record<string, number> = {};
  /** arrastando o mapa com um dedo (começou em chão vazio) */
  private pan: { x: number; y: number; moved: boolean } | null = null;
  /** há quanto tempo não há inimigos (para a música voltar à calma) */
  private calmT = 0;
  private bars!: Bars;
  private rig!: CameraRig;
  private radar!: Radar;
  private proj!: Projectiles;
  /** o primeiro chefe morreu: magos entram nas ondas */
  private magos = new URLSearchParams(import.meta.env.DEV ? location.search : '').has('magos');
  private orcs: Orc[] = [];
  private wave = 0;
  private waveTimer = -1;
  /** segundos desde que a onda atual começou, e quantos orcs dela ainda vão entrar */
  private waveAge = 0;
  private pending = 0;
  /** cabanas derrubadas (voltam quando a cidade é reerguida) */
  private fallen: { id: string; x: number; y: number; level: number; wave: number }[] = [];
  private combo = 0;
  private kills = 0;
  private lastCount = -1;
  private comboAt = -1e9;
  private over = false;
  isOver() { return this.over; }
  /** com atalhos de teste na barra de endereço, não lê nem grava o progresso */
  private persist = !['onda', 'moedas', 'magos', 'espada', 'mana'].some(k => new URLSearchParams(import.meta.env.DEV ? location.search : '').has(k));
  /** atalho de teste: ?onda=5 começa na onda 5 */
  private debugWave = Number(new URLSearchParams(import.meta.env.DEV ? location.search : '').get('onda')) || 0;

  constructor() { super('Game'); }

  create() {
    setMetaEnabled(this.persist);
    if (this.debugWave > 0) this.wave = this.debugWave - 1;
    // chão quadriculado
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.grass).fillRect(0, 0, 160, 160);
    g.fillStyle(COLORS.grassTile, 0.5).fillRect(0, 0, 80, 80).fillRect(80, 80, 80, 80);
    g.generateTexture('grama', 160, 160);
    g.destroy();
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H + 200, 'grama')
      .setOrigin(0).setDepth(-1e6);

    this.fx = new Particles(this);

    // centro da cidade: no meio do mapa
    const tex = this.textures.get('castelo').getSourceImage();
    const ch = 420 * tex.height / tex.width;
    this.castle = new Castle(this, WORLD_W / 2, WORLD_H / 2 + ch / 2, this.fx);
    this.rig = new CameraRig(this);
    this.radar = new Radar();
    this.rig.onMulti = () => this.cancelHeld();
    this.rig.centerOn(this.castle.x, this.castle.y - this.castle.h * 0.4);
    this.bars = new Bars(this);
    this.proj = new Projectiles(this, this.fx);

    this.ghost = this.add.image(0, 0, 'cabana_soldado_1').setOrigin(0.5, 1)
      .setAlpha(0.85).setVisible(false).setDepth(900_000);

    bus.on(Evt.Build, this.startPlacing, this);
    bus.on(Evt.Upgrade, this.upgradeSelected, this);
    bus.on(Evt.UpgradeSword, this.upgradeSword, this);
    bus.on(Evt.Rebuild, this.rebuild, this);
    bus.on(Evt.Power, this.usePower, this);
    bus.on(Evt.Gift, this.gift, this);
    bus.on(Evt.Perks, this.onPerk, this);
    bus.on(Evt.Sell, this.sellSelected, this);
    bus.on(Evt.Move, this.startMove, this);
    bus.on(Evt.Stars, this.onStars, this);
    this.events.once('shutdown', () => {
      bus.off(Evt.Perks, this.onPerk, this);
      bus.off(Evt.Sell, this.sellSelected, this);
      bus.off(Evt.Move, this.startMove, this);
      bus.off(Evt.Stars, this.onStars, this);
      bus.off(Evt.Gift, this.gift, this);
      bus.off(Evt.Power, this.usePower, this);
      bus.off(Evt.Rebuild, this.rebuild, this);
      bus.off(Evt.UpgradeSword, this.upgradeSword, this);
      bus.off(Evt.Build, this.startPlacing, this);
      bus.off(Evt.Upgrade, this.upgradeSelected, this);
    });
    this.loadProgress();
    // os orcs vêm mesmo sem nenhuma construção: senão dava para juntar moedas sem risco, para sempre
    const fresh = this.huts.length === 0;
    this.waveTimer = this.debugWave ? 4 : fresh ? WAVE.firstDelay : 10;
    // jogo novo: tutorial guiado (pulável); com atalhos de teste ele fica de fora
    if (fresh && this.wave === 0 && this.persist && store.get('hhk_tuto') !== '1') {
      tuto.on = true;
      bus.emit(Evt.Tuto, 'start');
    } else if (fresh) {
      bus.emit(Evt.Hint, t('hint.build_first'));
      this.time.delayedCall(9000, () => bus.emit(Evt.Hint, null));
    }
    sdk.loadingStop();
    sdk.setPlaying(true);
    bus.emit(Evt.Coins, state.coins);
    this.onCastleLevel(false);
    this.emitCosts();
    bus.emit(Evt.Wave, this.wave);
    bus.emit(Evt.Sword, state.sword);
    this.time.addEvent({ delay: 5000, loop: true, callback: () => this.save() });
    const flush = () => this.save();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-ESC', () => this.stopPlacing());
    // atalhos dos poderes: 1, 2 e 3
    window.addEventListener('keydown', e => {
      const i = ['1', '2', '3'].findIndex(n => e.code === 'Digit' + n || e.code === 'Numpad' + n);
      if (i >= 0 && !e.repeat && POWERS[i]) this.usePower(POWERS[i].id);
    });
    this.input.on('pointermove', this.onMove, this);
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
      sword: state.sword,
      mana: Math.floor(state.mana),
      huts: [
        ...this.huts.map(h => ({ id: h.def.id, dx: Math.round(h.x - this.castle.x), dy: Math.round(h.y - this.castle.y), level: h.level })),
        // a cabana levantada para mudar de lugar não pode se perder se a página fechar
        ...(this.moving ? [{ id: this.moving.def.id, dx: Math.round(this.moving.x - this.castle.x), dy: Math.round(this.moving.y - this.castle.y), level: this.moving.level }] : []),
      ],
    });
  }

  private loadProgress() {
    if (!this.persist) return;
    const d = loadGame();
    if (!d) {
      // cidade nova: a melhoria "Começo rápido" da Forja Real dá moedas
      state.coins += startBonus();
      return;
    }
    state.coins = d.coins;
    if (d.mana) state.mana = d.mana;
    if (d.sword) state.sword = Math.min(SWORD_MAX, d.sword);
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
    bus.emit(Evt.Hint, t('hint.welcome_back'));
    this.time.delayedCall(4000, () => bus.emit(Evt.Hint, null));
  }

  /** Avisa a tela do nível do Centro da Vila e da mana. No nível 4 a cidade dá mana de presente. */
  private onCastleLevel(justUpgraded: boolean) {
    bus.emit(Evt.Castle, this.castle.level + 1);
    this.emitMana();
    if (justUpgraded && this.castle.level + 1 === MAGIC_CASTLE_LEVEL) {
      addMana(MANA_GIFT);
      this.emitMana();
      floatText(this, this.castle.x, this.castle.y - this.castle.h - 20, t('fl.mana_unlocked', { n: MANA_GIFT }), '#7ad0ff');
      bus.emit(Evt.Hint, t('hint.mana_unlocked'));
      this.time.delayedCall(6000, () => bus.emit(Evt.Hint, null));
    }
  }

  /** Uma melhoria da Forja Real foi comprada: vale na hora para a cidade e os soldados que já existem. */
  private onPerk() {
    this.castle.rescale();
    for (const h of this.huts) {
      h.rescale();
      for (const s of h.soldiers) s.rescale();
    }
  }

  /** estrelas ganhas durante o jogo aparecem sobre o castelo */
  private onStars(_total: number, gained: number) {
    if (gained <= 0 || this.over) return;
    floatText(this, this.castle.x + Phaser.Math.Between(-60, 60), this.castle.y - this.castle.h - 30, '+' + gained + ' ⭐', '#ffe45a');
  }

  private emitMana(perSec?: number) {
    let inc = perSec;
    if (inc === undefined) {
      inc = this.castle.level + 1 >= MAGIC_CASTLE_LEVEL ? CASTLE_MANA_INCOME : 0;
      for (const h of this.huts) inc += h.manaIncome;
    }
    bus.emit(Evt.Mana, state.mana, inc);
  }

  /* ---------- poderes ---------- */

  private usePower(id: string) {
    const def = POWERS.find(p => p.id === id);
    if (!def || this.over || this.castle.level + 1 < MAGIC_CASTLE_LEVEL) return;
    const now = performance.now();
    if ((this.powerReady[id] ?? 0) > now) { sfx.error(); return; }
    const alive = this.orcs.filter(o => o.alive);
    if (id !== 'curar' && alive.length === 0) {
      bus.emit(Evt.Hint, t('hint.no_enemies'));
      this.time.delayedCall(1800, () => bus.emit(Evt.Hint, null));
      return;
    }
    if (!spendMana(def.cost)) {
      bus.emit(Evt.Broke, 'power:' + id);
      bus.emit(Evt.Hint, t('hint.no_mana'));
      this.time.delayedCall(1800, () => bus.emit(Evt.Hint, null));
      return;
    }
    this.powerReady[id] = now + def.cd * 1000;
    bus.emit(Evt.PowerCd, id, def.cd);
    this.emitMana();

    if (id === 'meteoros') {
      // os inimigos mais perto da cidade levam os meteoros primeiro
      const targets = [...alive].sort((a, b) =>
        Math.hypot(a.x - this.castle.x, a.y - this.castle.y) - Math.hypot(b.x - this.castle.x, b.y - this.castle.y))
        .slice(0, POWER_METEOR_COUNT);
      const dmg = meteorDamage(this.wave);
      targets.forEach((o, i) => {
        this.proj.strike(o.x, o.y, 100, 0.7 + i * 0.12, (x, y, r) => {
          for (const e of this.orcs) {
            if (e.alive && Math.hypot(e.x - x, (e.y - y) * 2) < r) e.takeDamage(dmg, x, y);
          }
        }, true);
      });
      sfx.strikeCharge(0.8);
      bus.emit(Evt.Hint, t('hint.meteors'));
    } else if (id === 'congelar') {
      for (const o of alive) o.freeze(POWER_FREEZE_SECONDS);
      sfx.magic();
      bus.emit(Evt.Hint, t('hint.frozen', { n: POWER_FREEZE_SECONDS }));
    } else {
      for (const h of this.huts) {
        h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.5);
        for (const s of h.soldiers) s.renew();
        this.fx.burst(h.x, h.y - h.h * 0.5, 14, 0x6dff9a);
      }
      this.castle.hp = Math.min(this.castle.maxHp, this.castle.hp + this.castle.maxHp * 0.4);
      this.fx.burst(this.castle.x, this.castle.y - this.castle.h * 0.5, 24, 0x6dff9a, true);
      sfx.upgrade();
      bus.emit(Evt.Hint, t('hint.healed'));
    }
    this.time.delayedCall(2500, () => bus.emit(Evt.Hint, null));
    this.save();
  }

  /** Preço de construir mais uma deste tipo (sobe com quantas você já tem). */
  private costOf(def: HutDef) {
    return buildCost(def, this.huts.filter(h => h.def === def).length);
  }

  private emitCosts() {
    const costs: Record<string, number> = {};
    for (const d of BUILDABLES) costs[d.id] = this.costOf(d);
    bus.emit(Evt.BuildCosts, costs);
  }

  private get allSoldiers() { return this.huts.flatMap(h => h.soldiers); }

  /* ---------- construir ---------- */

  private startPlacing(id: string) {
    if (this.moving) this.stopPlacing();
    const def = hutDef(id);
    if (def.maxCount && this.huts.filter(h => h.def === def).length >= def.maxCount) {
      bus.emit(Evt.Broke, id);
      bus.emit(Evt.Hint, t('hint.limit', { n: def.maxCount, name: t(`name.${def.id}` as Key) }));
      this.time.delayedCall(2200, () => !this.placing && bus.emit(Evt.Hint, null));
      return;
    }
    if (this.placing === def) { this.stopPlacing(); return; }
    if (def.needCastle && this.castle.level + 1 < def.needCastle) {
      bus.emit(Evt.Broke, id);
      bus.emit(Evt.Hint, t('hint.needs_castle', { n: def.needCastle }));
      this.time.delayedCall(2200, () => !this.placing && bus.emit(Evt.Hint, null));
      return;
    }
    if ((def.currency === 'mana' ? state.mana : state.coins) < this.costOf(def)) {
      bus.emit(Evt.Broke, id);
      bus.emit(Evt.Hint, def.currency === 'mana' ? t('hint.no_mana') : t('hint.no_coins'));
      this.time.delayedCall(1800, () => !this.placing && bus.emit(Evt.Hint, null));
      return;
    }
    this.held = null;
    this.select(null);
    this.placing = def;
    // no celular a construção aparece no meio da tela, para você arrastar e soltar
    if (this.rig.touch) this.rig.setMouse(this.scale.width / 2, (this.scale.height - barH()) * 0.45);
    const lv = def.levels[0];
    this.ghostLv = lv;
    const tex = this.textures.get(lv.art).getSourceImage();
    this.ghost.setTexture(lv.art).setDisplaySize(lv.width, lv.width * tex.height / tex.width).setVisible(true);
    bus.emit(Evt.Placing, id);
    bus.emit(Evt.Hint, this.rig.touch
      ? t('hint.place_touch')
      : t('hint.place_mouse'));
  }

  private stopPlacing() {
    if (!this.placing) return;
    // desistiu de mover: a cabana volta, sem custo, para onde estava
    if (this.moving) {
      const m = this.moving;
      this.moving = null;
      this.restoreHut({ id: m.def.id, x: m.x, y: m.y, level: m.level });
      this.emitCosts();
    }
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
    if (this.rig.toScreen(b.x, b.y).y > this.scale.height - barH() - 4) return false;
    if (overlaps(b, this.castle)) return false;
    return !this.huts.some(h => overlaps(b, h));
  }

  private placeHut(def: HutDef) {
    const b = this.ghostBuilding();
    if (!this.canPlace(b)) { bus.emit(Evt.Hint, t('hint.no_room')); return; }
    const mv = this.moving;
    const price = mv ? mv.cost : this.costOf(def);
    if (!(def.currency === 'mana' ? spendMana(price) : spend(price))) {
      bus.emit(Evt.Broke, def.id);
      return;
    }
    this.emitMana();
    const hut = new Hut(this, def, b.x, b.y, this.fx, h => this.onHutDestroyed(h));
    if (mv) { hut.restore(mv.level); this.moving = null; }
    this.huts.push(hut);
    this.fx.burst(b.x, b.y, 24, 0xe8d9b8, true);
    this.emitCosts();
    sfx.build();
    this.stopPlacing();
    this.select(hut);
    this.save();
    if (mv) { floatText(this, b.x, b.y - hut.h - 10, t('hint.moved'), '#7CFF6B'); return; }
    bus.emit(Evt.Tuto, 'placed');
    // no tutorial os orcs chegam logo depois da primeira cabana
    if (tuto.on && this.waveTimer > 9) this.waveTimer = 9;
    if (tuto.on) { this.stopPlacing(); this.select(null); } else
    bus.emit(Evt.Hint, def.levels[0].soldiers.length ? t('hint.built_troops') : (def.currency === 'mana' ? t('hint.built_mana_mine') : t('hint.built_mine')));
    this.time.delayedCall(5000, () => bus.emit(Evt.Hint, null));
  }

  /* ---------- vender e mover ---------- */

  /** sem inimigos (nem por entrar): só então dá para vender ou mover cabanas */
  private calm() {
    return !tuto.on && this.pending === 0 && !this.orcs.some(o => o.alive);
  }

  /** o que a cabana já valeu: o preço de todos os níveis até o dela */
  private hutValue(h: Hut) {
    let v = 0;
    for (let i = 0; i <= h.level; i++) v += h.def.levels[i].cost;
    return v;
  }
  private refundOf(h: Hut) { return Math.round(this.hutValue(h) * SELL_REFUND); }
  private moveCostOf(h: Hut) { return Math.max(5, Math.round(this.hutValue(h) * MOVE_COST)); }

  private notCalm() {
    bus.emit(Evt.Broke, 'tools');
    bus.emit(Evt.Hint, t('hint.only_calm'));
    this.time.delayedCall(2600, () => bus.emit(Evt.Hint, null));
  }

  private sellSelected() {
    const h = this.selected;
    if (!(h instanceof Hut) || this.over) return;
    if (!this.calm()) { this.notCalm(); return; }
    const n = this.refundOf(h);
    const mana = h.def.currency === 'mana';
    const x = h.x, y = h.y - h.h * 0.6;
    this.huts = this.huts.filter(x2 => x2 !== h);
    h.dismantle();
    this.select(null);
    if (mana) { addMana(n); this.emitMana(); } else addCoins(n);
    sfx.coin();
    floatText(this, x, y, '+' + n, mana ? '#7ad0ff' : '#ffd84a');
    bus.emit(Evt.Hint, t('hint.sold', { n }));
    this.time.delayedCall(3000, () => bus.emit(Evt.Hint, null));
    this.emitCosts();
    this.save();
  }

  /** Levanta a cabana selecionada e deixa escolher onde pôr: pagar só ao largar; desistir devolve ao lugar. */
  private startMove() {
    const h = this.selected;
    if (!(h instanceof Hut) || this.over || this.placing) return;
    if (!this.calm()) { this.notCalm(); return; }
    const cost = this.moveCostOf(h);
    const mana = h.def.currency === 'mana';
    if ((mana ? state.mana : state.coins) < cost) {
      bus.emit(Evt.Broke, 'tools');
      bus.emit(Evt.Hint, mana ? t('hint.no_mana') : t('hint.no_coins'));
      this.time.delayedCall(1800, () => bus.emit(Evt.Hint, null));
      return;
    }
    const lv = h.def.levels[h.level];
    this.moving = { def: h.def, level: h.level, x: h.x, y: h.y, cost };
    this.huts = this.huts.filter(x => x !== h);
    h.dismantle();
    this.select(null);
    this.emitCosts();
    this.held = null;
    this.placing = h.def;
    this.ghostLv = lv;
    if (this.rig.touch) this.rig.setMouse(this.scale.width / 2, (this.scale.height - barH()) * 0.45);
    const tex = this.textures.get(lv.art).getSourceImage();
    this.ghost.setTexture(lv.art).setDisplaySize(lv.width, lv.width * tex.height / tex.width).setVisible(true);
    bus.emit(Evt.Placing, null);
    bus.emit(Evt.Hint, this.rig.touch ? t('hint.place_touch') : t('hint.place_mouse'));
  }

  /* ---------- selecionar / evoluir ---------- */

  private select(item: Hut | Castle | null) {
    this.selected?.setSelected(false);
    this.selected = item;
    item?.setSelected(true);
    this.emitSelect();
  }

  /** Até que nível esta construção pode evoluir com o Centro da Vila de agora. */
  private hutCap(def: HutDef) {
    const lv = this.castle.level + 1;
    return Math.min(this.castle.hutMax, def.maxLevelByCastle?.(lv) ?? Infinity);
  }

  /** Menor nível do Centro da Vila que libera o nível `target` desta construção. */
  private castleNeeded(def: HutDef, target: number) {
    for (let c = this.castle.level + 2; c <= CASTLE_LEVELS.length; c++) {
      if (Math.min(CASTLE_LEVELS[c - 1].hutMax, def.maxLevelByCastle?.(c) ?? Infinity) >= target) return c;
    }
    return CASTLE_LEVELS.length;
  }

  private emitSelect() {
    const h = this.selected;
    if (!h) { bus.emit(Evt.Select, null); return; }
    const nx = h.next;
    // cabana: o próximo nível só abre se o centro da vila deixar
    let lock: string | undefined;
    if (h instanceof Hut && nx && h.level + 2 > this.hutCap(h.def)) lock = t('ui.lock_castle', { n: this.castleNeeded(h.def, h.level + 2) });
    // o centro da vila também espera você chegar a uma onda
    if (h instanceof Castle && h.next && this.wave < h.next.minWave) lock = t('ui.lock_wave', { n: h.next.minWave });
    const info: SelectInfo = {
      key: `${h.x},${h.y}`,
      x: h.x, y: h.y - h.h - 26,
      next: nx ? { art: nx.art, cost: nx.cost, lock, mana: h instanceof Hut && h.def.currency === 'mana' } : null,
      tools: h instanceof Hut ? { refund: this.refundOf(h), move: this.moveCostOf(h), mana: h.def.currency === 'mana', ok: this.calm() } : undefined,
    };
    bus.emit(Evt.Select, info);
    this.emitSelPos();
  }

  /** O botão de upgrade é HTML: acompanha a câmera. */
  private emitSelPos() {
    const h = this.selected;
    if (!h) return;
    // a roda de botões gira em volta do meio da construção; o raio acompanha o zoom
    const p = this.rig.toScreen(h.x, h.y - h.h * 0.5);
    const r = Phaser.Math.Clamp(Math.max(h.w, h.h) * 0.5 * this.rig.zoom * 0.9 + 52, 80, 260);
    bus.emit(Evt.SelPos, p.x, p.y, r);
  }

  private upgradeSelected() {
    const h = this.selected, nx = h?.next;
    if (!h || !nx) return;
    if (h instanceof Hut && h.level + 2 > this.hutCap(h.def)) {
      bus.emit(Evt.Broke, 'upgrade');
      bus.emit(Evt.Hint, t('hint.needs_town', { n: this.castleNeeded(h.def, h.level + 2), l: h.level + 2 }));
      this.time.delayedCall(3000, () => bus.emit(Evt.Hint, null));
      return;
    }
    if (h instanceof Castle && this.wave < (h.next?.minWave ?? 0)) {
      bus.emit(Evt.Broke, 'upgrade');
      bus.emit(Evt.Hint, t('hint.survive_wave', { n: h.next?.minWave ?? 0 }));
      this.time.delayedCall(3000, () => bus.emit(Evt.Hint, null));
      return;
    }
    const useMana = h instanceof Hut && h.def.currency === 'mana';
    if (!(useMana ? spendMana(nx.cost) : spend(nx.cost))) { bus.emit(Evt.Broke, 'upgrade'); return; }
    if (useMana) this.emitMana();
    const artBefore = h instanceof Hut ? h.def.levels[h.level].art : '';
    h.upgrade();
    // quando o visual da construção muda (de 5 em 5 níveis) a comemoração é maior
    const novoVisual = h instanceof Hut && h.def.levels[h.level].art !== artBefore;
    floatText(this, h.x, h.y - h.h - 10, novoVisual ? t('fl.new_look') : t('fl.upgraded'), '#7CFF6B');
    if (novoVisual) { this.fx.burst(h.x, h.y - h.h * 0.5, 36, 0xffd84a, true); this.cameras.main.shake(200, 0.005); }
    sfx.upgrade(h instanceof Castle);
    bus.emit(Evt.Tuto, 'upgrade');
    if (h instanceof Castle) this.onCastleLevel(true);
    this.save();
    this.emitSelect();
  }

  /** Evolui a espada do clique (carta na barra de baixo). */
  private upgradeSword() {
    if (state.sword >= SWORD_MAX) return;
    if (!spend(swordCost(state.sword))) {
      bus.emit(Evt.Broke, 'sword');
      bus.emit(Evt.Hint, t('hint.sword_coins'));
      this.time.delayedCall(1800, () => bus.emit(Evt.Hint, null));
      return;
    }
    const before = swordTier(state.sword).art;
    state.sword++;
    bus.emit(Evt.Sword, state.sword);
    const mw = this.mouse;
    const novoVisual = swordTier(state.sword).art !== before;
    sfx.upgrade(novoVisual);
    floatText(this, mw.x, mw.y - 30, novoVisual ? t('fl.new_sword') : t('fl.sword_lv', { n: state.sword }), '#7CFF6B');
    this.fx.burst(mw.x, mw.y, novoVisual ? 28 : 10, 0xffe28a, novoVisual);
    if (novoVisual) this.cameras.main.shake(180, 0.004);
    this.save();
  }

  /* ---------- mouse ---------- */

  /**
   * Inimigos que o golpe em (x, y) alcança: quem está sob o clique ou a até `reach` px do corpo dele.
   * Vêm do mais perto para o mais longe.
   */
  private orcsNear(x: number, y: number, reach: number): Orc[] {
    const hit: { o: Orc; d: number }[] = [];
    for (const o of this.orcs) {
      if (!o.alive) continue;
      const hgt = o.stats.height;
      // distância do clique até a caixa do corpo (zero se o clique estiver em cima dele)
      const dx = Math.max(Math.abs(x - o.x) - hgt * 0.38, 0);
      const dy = Math.max(o.y - hgt - y, y - (o.y + 6), 0);
      const d = Math.hypot(dx, dy);
      if (d <= reach) hit.push({ o, d });
    }
    return hit.sort((a, b) => a.d - b.d).map(h => h.o);
  }

  /** Golpe do clique: o mais perto leva o dano inteiro, os outros dentro da área levam uma parte. */
  private clickHit(targets: Orc[], x: number, y: number, touch: boolean) {
    const dmg = Math.round(swordDamage(state.sword) * perkMult('sword'));
    const radius = swordRadius(state.sword);
    targets.forEach((o, i) => {
      o.takeDamage(i === 0 ? dmg : Math.max(1, Math.round(dmg * CLICK_AOE_MULT)), x, y);
    });
    this.fx.burst(x, y, 7, 0xffe28a);
    sfx.swordHit();
    bus.emit(Evt.Tuto, 'hit');
    const ring = this.add.ellipse(x, y, radius * 0.8, radius * 0.5)
      .setStrokeStyle(4, 0xfff0c0).setDepth(900_000);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    // no celular não existe cursor: a espada aparece dando o golpe
    if (touch) this.swordSwing(x, y);
  }

  /** Espada que desce cortando o ponto tocado (só quando o golpe acerta alguém). */
  private swordSwing(x: number, y: number) {
    const z = this.rig.zoom;
    const sword = this.add.image(x + 26 / z, y + 34 / z, swordTier(state.sword).art)
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

  /** Um segundo dedo entrou (pinça): larga o soldado que o primeiro dedo segurava. */
  private cancelHeld() {
    this.pan = null;
    if (this.held) { this.held.throwWith(0, 0); this.held = null; }
  }

  /** Dedo arrastando em chão vazio move o mapa. */
  private onMove(p: Phaser.Input.Pointer) {
    if (!this.pan || !p.isDown || this.rig.multi) return;
    const dx = p.x - this.pan.x, dy = p.y - this.pan.y;
    if (!this.pan.moved && Math.hypot(dx, dy) < 10) return;
    this.pan.moved = true;
    this.rig.panBy(dx, dy);
    this.pan.x = p.x;
    this.pan.y = p.y;
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.rig.multi) return;
    this.rig.setMouse(p.x, p.y);
    const wp = this.rig.toWorld(p.x, p.y);
    this.mouse.set(wp.x, wp.y);
    if (this.placing) {
      // no celular o dedo arrasta a construção e ela é colocada ao soltar
      if (p.rightButtonDown()) this.stopPlacing(); else if (!p.wasTouch) this.placeHut(this.placing);
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
      bus.emit(Evt.Tuto, 'grab');
      this.samples = [{ x: wp.x, y: wp.y, t: performance.now() }];
      bus.emit(Evt.Hint, null);
      return;
    }
    // inimigo: o clique bate nele
    // a área da espada é generosa: acerta quem estiver sob o clique ou bem pertinho
    const foes = this.orcsNear(wp.x, wp.y, swordRadius(state.sword) * 0.6);
    if (foes.length) { this.clickHit(foes, wp.x, wp.y, p.wasTouch); return; }
    const hit: Hut | Castle | null = [...this.huts].reverse().find(h => h.contains(wp.x, wp.y))
      ?? (this.castle.contains(wp.x, wp.y) ? this.castle : null);
    // dedo em chão vazio: arrasta o mapa (e, se nem mexeu, é só um toque que desmarca)
    if (p.wasTouch && !hit) { this.pan = { x: p.x, y: p.y, moved: false }; return; }
    this.select(hit === this.selected ? null : hit);
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (this.pan) {
      if (!this.pan.moved && !this.rig.multi) this.select(null);
      this.pan = null;
      return;
    }
    // celular: a construção é colocada onde o dedo soltou
    if (this.placing && p.wasTouch) {
      if (!this.rig.multi) {
        const mw = this.rig.mouseWorld();
        this.mouse.set(mw.x, mw.y);
        this.placeHut(this.placing);
      }
      return;
    }
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
    bus.emit(Evt.Tuto, 'throw');
  }

  /* ---------- loop ---------- */

  /* ---------- ondas de orcs ---------- */

  private spawnWave() {
    this.wave++;
    bus.emit(Evt.Wave, this.wave);
    this.noteBest();
    this.save();
    if (this.selected) this.emitSelect();
    const boss = isBossWave(this.wave);
    const n = WAVE.count(this.wave);
    sfx.horn();
    bus.emit(Evt.Tuto, 'wave');
    if (boss) sfx.bossRoar();
    // entram de longe, num círculo em volta da cidade (o mapa é grande: nas bordas demorariam demais)
    const around = (dist: number) => {
      const a = Math.random() * Math.PI * 2;
      return {
        x: Phaser.Math.Clamp(this.castle.x + Math.cos(a) * dist, 40, WORLD_W - 40),
        y: Phaser.Math.Clamp(this.castle.y + Math.sin(a) * dist * 0.8, 60, WORLD_H - 40),
      };
    };
    this.pending += n;
    for (let i = 0; i < n; i++) {
      // no tutorial os orcs entram bem perto, para dar para clicar neles logo
      const { x, y } = around(tuto.on ? 620 + Math.random() * 120 : 1100 + Math.random() * 300);
      this.time.delayedCall(i * 450, () => {
        this.pending = Math.max(0, this.pending - 1);
        if (this.over) return;
        const kind = pickOrcKind(this.wave, this.magos);
        this.orcs.push(new Orc(this, x, y, kind, this.wave, this.fx, o => this.onOrcDie(o)));
      });
    }
    if (boss) {
      const bp = around(1300);
      this.orcs.push(new Orc(this, bp.x, bp.y, 'boss', this.wave, this.fx, o => this.onOrcDie(o)));
      this.cameras.main.shake(600, 0.01);
      bus.emit(Evt.Hint, t('hint.boss', { w: this.wave }));
      bus.emit(Evt.Banner, { title: t('banner.boss'), sub: t('banner.boss_sub', { w: this.wave }), kind: 'boss' });
    } else {
      bus.emit(Evt.Hint, t('hint.wave', { w: this.wave, n }) + (this.wave === 1 ? t('hint.click_them') : ''));
      bus.emit(Evt.Banner, { title: t('banner.wave', { w: this.wave }), sub: t('banner.orcs', { n }), kind: 'wave' });
    }
    this.time.delayedCall(4500, () => bus.emit(Evt.Hint, null));
  }

  private onHutDestroyed(h: Hut) {
    this.fallen.push({ id: h.def.id, x: h.x, y: h.y, level: h.level, wave: this.wave });
    this.huts = this.huts.filter(x => x !== h);
    this.emitCosts();
    this.save();
    if (this.selected === h) { this.selected = null; this.emitSelect(); }
    floatText(this, h.x, h.y - h.h * 0.6, t('fl.hut_destroyed'), '#ff5a4d');
    this.cameras.main.shake(180, 0.004);
  }

  private onOrcDie(o: Orc) {
    if (o.stats.boss && !this.magos) {
      this.magos = true;
      bus.emit(Evt.Hint, t('hint.boss_dead'));
      this.time.delayedCall(5000, () => bus.emit(Evt.Hint, null));
    }
    const reward = Math.max(1, Math.round(o.stats.coins * KILL_COIN_MULT * perkMult('treasure')));
    addCoins(reward);
    // estrelas reais: uma a cada 10 orcs, e o Rei Orc vale mais
    noteKill();
    if (o.stats.boss) addStars(STARS_BOSS_KILL);
    sfx.coin();
    floatText(this, o.x, o.y - o.stats.height - 30, '+' + reward);
    this.kills++;
    // vários orcs derrotados em seguida viram um combo
    const now = this.time.now;
    this.combo = now - this.comboAt < 2500 ? this.combo + 1 : 1;
    this.comboAt = now;
    if (COMBO_AT.includes(this.combo)) bus.emit(Evt.Banner, { title: t('banner.combo', { n: this.combo }), kind: 'combo' });
  }

  /** Moedas de presente por assistir a um anúncio: uns 90 segundos de renda, no mínimo 400. */
  private gift() {
    let inc = this.castle.income;
    for (const h of this.huts) inc += h.income;
    const n = Math.max(400, Math.round(inc * 90));
    addCoins(n);
    sfx.upgrade(true);
    this.fx.burst(this.castle.x, this.castle.y - this.castle.h * 0.5, 30, 0xffd84a, true);
    bus.emit(Evt.Hint, t('hint.ad_reward', { n }));
    this.time.delayedCall(4000, () => bus.emit(Evt.Hint, null));
    this.save();
  }

  /** Perder não apaga tudo: a cidade é reerguida com um custo pequeno. */
  private rebuild(opts?: { free?: boolean }) {
    if (!this.over) return;
    const free = !!opts?.free;
    this.over = false;
    sdk.setPlaying(true);
    for (const o of this.orcs) o.vanish();
    this.orcs = [];
    this.proj.clear();
    // com anúncio com recompensa, reerguer não custa nada
    if (!free) state.coins = Math.floor(state.coins * REBUILD_COIN_KEEP);
    bus.emit(Evt.Coins, state.coins);
    // as cabanas derrubadas nas últimas ondas voltam do jeito que eram, onde não houver outra coisa no lugar
    const lost = this.fallen.filter(f => f.wave >= this.wave - REBUILD_HUT_WAVES);
    this.fallen = [];
    for (const f of lost) this.restoreHut(f);
    this.emitCosts();
    const back = free ? 0 : rebuildBack(this.wave);
    this.wave = Math.max(0, this.wave - back);
    bus.emit(Evt.Wave, this.wave);
    this.waveTimer = 25;
    this.waveAge = 0;
    this.castle.hp = this.castle.maxHp;
    for (const h of this.huts) {
      h.hp = h.maxHp;
      for (const s of h.soldiers) s.renew();
    }
    this.fx.burst(this.castle.x, this.castle.y - this.castle.h * 0.5, 40, 0xffd84a, true);
    this.cameras.main.shake(250, 0.006);
    sfx.upgrade(true);
    audio.set('calma');
    bus.emit(Evt.Hint, free ? t('hint.ad_free_rebuild') : t('hint.rebuilt', { p: Math.round((1 - REBUILD_COIN_KEEP) * 100), w: back }));
    this.time.delayedCall(6000, () => bus.emit(Evt.Hint, null));
    this.save();
  }

  /** Põe de volta uma cabana derrubada, a menos que já haja algo no lugar. */
  private restoreHut(f: { id: string; x: number; y: number; level: number }) {
    const def = hutDef(f.id);
    const lv = def.levels[Math.min(f.level, def.levels.length - 1)];
    const tex = this.textures.get(lv.art).getSourceImage();
    const b: Building = { x: f.x, y: f.y, w: lv.width, h: lv.width * tex.height / tex.width };
    if (overlaps(b, this.castle) || this.huts.some(h => overlaps(b, h))) return;
    const hut = new Hut(this, def, f.x, f.y, this.fx, h => this.onHutDestroyed(h));
    hut.restore(f.level);
    this.huts.push(hut);
    this.fx.burst(f.x, f.y - 20, 18, 0xe8d9b8, true);
  }

  /** guarda a melhor onda de todas as partidas e devolve o recorde */
  private noteBest(): number {
    const best = Number(store.get('hhk_best')) || 0;
    if (this.wave > best && this.persist) {
      store.set('hhk_best', String(this.wave));
      // cada onda nova (nunca alcançada antes) vale estrelas: perder e reerguer não rende estrelas repetidas
      addStars(isBossWave(this.wave) ? STARS_RECORD_BOSS_WAVE : STARS_RECORD_WAVE);
    }
    return Math.max(best, this.wave);
  }

  private lose() {
    this.stopPlacing();
    this.over = true;
    this.held = null;
    sdk.setPlaying(false);
    sfx.gameOver();
    audio.set('calma');
    const best = Math.max(this.noteBest(), this.wave);
    bus.emit(Evt.Countdown, null);
    bus.emit(Evt.GameOver, { wave: this.wave, kills: this.kills, best });
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.over) return;

    // câmera: zoom, bordas e teclas; o mouse passa a valer em coordenadas do mapa
    // no celular a coisa fica acima do dedo, para o dedo não cobrir
    this.rig.fingerOffset = this.rig.touch && this.rig.down && (this.placing || this.held) ? 70 : 0;
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
      sfx.coinSoft();
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
      // mana: só depois do Centro da Vila nível 4
      if (this.castle.level + 1 >= MAGIC_CASTLE_LEVEL) {
        let mana = CASTLE_MANA_INCOME;
        for (const h of this.huts) mana += h.manaIncome;
        addMana(mana);
        this.emitMana(mana);
      }
    }

    if (this.placing) {
      const b = this.ghostBuilding();
      const ok = this.canPlace(b);
      const bob = Math.abs(Math.sin(time / 1000 * 9)) * 10;
      const base = (this.ghostLv ?? this.placing.levels[0]).width / this.ghost.width;
      this.ghost.setPosition(b.x, b.y - bob)
        .setScale(base * (1 + bob * 0.004), base * (1 - bob * 0.004))
        .setRotation(Math.sin(time / 1000 * 5) * 0.04);
      if (ok) this.ghost.clearTint(); else this.ghost.setTint(0xff7070);
    }

    // vender e mover só entre ondas: avisa a tela quando isso muda
    const calmNow = this.calm();
    if (calmNow !== this.calmShown) { this.calmShown = calmNow; if (this.selected instanceof Hut) this.emitSelect(); }

    // ondas
    if (this.waveTimer >= 0) {
      // a preparação só corre quando não resta nenhum inimigo da onda (ou se algum ficou preso há muito tempo)
      this.waveAge += dt;
      const fighting = this.pending > 0 || this.orcs.some(o => o.alive);
      const ticking = !fighting || this.waveAge > WAVE.maxFight;
      if (ticking) this.waveTimer -= dt;
      if (this.waveTimer <= 0) { this.spawnWave(); this.waveTimer = WAVE.interval; this.waveAge = 0; }
      const left = ticking && this.waveTimer >= 0 && this.waveTimer < 600 ? Math.ceil(this.waveTimer) : -1;
      if (left !== this.lastCount) { this.lastCount = left; bus.emit(Evt.Countdown, left >= 0 ? left : null); }
    }

    const floor = WORLD_H;
    this.bars.begin();
    const soldiers = this.allSoldiers;
    const alive = this.orcs.filter(o => o.alive);
    // a música acompanha o perigo: calma, batalha, chefe
    if (alive.some(o => o.stats.boss)) { this.calmT = 0; audio.set('chefe'); }
    else if (alive.length > 0) { this.calmT = 0; audio.set('batalha'); }
    else { this.calmT += dt; if (this.calmT > 4) audio.set('calma'); }
    for (const s of soldiers) s.update(dt, this.mouse, WORLD_W, floor, alive, this.bars, this.proj);
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
    // setas na borda da tela apontando os inimigos que estão fora de vista
    this.radar.draw(alive.map(o => {
      const p = this.rig.toScreen(o.x, o.y - o.stats.height * 0.5);
      return { x: p.x, y: p.y, hot: o.hittingBuilding, boss: !!o.stats.boss };
    }), this.scale.width, this.scale.height, barH());
    this.castle.drawBar(this.bars);
    for (const h of this.huts) h.drawBar(this.bars);
    if (!this.castle.alive) this.lose();

    this.proj.update(dt);
    this.fx.update(dt);
  }
}
