import Phaser from 'phaser';
import { barH, EDGE_SCROLL_PX, SCROLL_SPEED, WORLD_H, WORLD_W, ZOOM_MAX } from './config';

/**
 * Câmera estilo Warcraft 3: o mapa é maior que a tela.
 * Computador: roda do mouse = zoom (em direção ao mouse); mouse nas bordas ou setas/WASD = mover.
 * Celular: pinça = zoom, dois dedos = mover (e um dedo arrastando no chão vazio, ver GameScene).
 * Faz as contas de tela <-> mundo à mão, para não depender do estado do quadro anterior.
 */
export class CameraRig {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  /** posição do ponteiro na janela (px) */
  private sx = 0;
  private sy = 0;
  private inside = false;

  /** o último toque foi de dedo (e não de mouse) */
  touch = false;
  /** o dedo está encostado na tela agora */
  down = false;
  /** o dedo segura algo (soldado, cabana): a coisa aparece um pouco acima, para o dedo não cobrir */
  fingerOffset = 0;
  /** avisa a cena quando um segundo dedo entra (para largar o que o primeiro segurava) */
  onMulti?: () => void;

  private touches = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };
  private multiUntil = 0;
  private lastW = 0;
  private lastH = 0;

  constructor(private scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
    this.keys = scene.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;

    const move = (e: PointerEvent) => {
      this.touch = e.pointerType === 'touch';
      this.sx = e.clientX;
      this.sy = e.clientY;
      // a rolagem pela borda é coisa de mouse
      this.inside = !this.touch;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', e => { move(e); this.down = true; });
    window.addEventListener('pointerup', () => { this.down = false; });
    window.addEventListener('pointercancel', () => { this.down = false; });
    document.documentElement.addEventListener('mouseleave', () => { this.inside = false; });
    document.documentElement.addEventListener('mouseenter', () => { this.inside = !this.touch; });

    const host = document.getElementById('game')!;
    host.addEventListener('wheel', e => { e.preventDefault(); this.zoomBy(e.deltaY, e.clientX, e.clientY); }, { passive: false });

    // pinça e dois dedos
    window.addEventListener('touchstart', e => this.onTouches(e, true), { passive: false });
    window.addEventListener('touchmove', e => this.onTouches(e, false), { passive: false });
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2 && this.touches.size >= 2) this.multiUntil = performance.now() + 250;
      this.touches.clear();
      for (const t of Array.from(e.touches)) this.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    };
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);

    // girar o celular ou mudar a janela: o ponto do mapa que estava no meio continua no meio
    this.lastW = this.w;
    this.lastH = this.h;
    scene.scale.on('resize', () => {
      const cx = this.cam.scrollX + this.lastW / 2, cy = this.cam.scrollY + this.lastH / 2;
      this.lastW = this.w;
      this.lastH = this.h;
      this.cam.scrollX = cx - this.w / 2;
      this.cam.scrollY = cy - this.h / 2;
      this.setZoom(this.cam.zoom);
    });
    // no celular começa com mais mapa à vista; no computador, zoom normal
    this.setZoom(Math.min(1, Math.max(this.minZoom, Math.min(this.w / 760, this.h / 700))));
  }

  private get w() { return this.scene.scale.width; }
  private get h() { return this.scene.scale.height; }

  get zoom() { return this.cam.zoom; }

  /** dois ou mais dedos na tela (ou acabaram de sair): não é um toque comum */
  get multi() { return this.touches.size >= 2 || performance.now() < this.multiUntil; }

  /** menor zoom em que o mapa ainda preenche a tela inteira */
  private get minZoom() { return Math.max(this.w / WORLD_W, this.h / (WORLD_H + barH())); }

  toWorld(sx: number, sy: number) {
    const z = this.cam.zoom;
    return { x: this.cam.scrollX + this.w / 2 + (sx - this.w / 2) / z, y: this.cam.scrollY + this.h / 2 + (sy - this.h / 2) / z };
  }

  toScreen(wx: number, wy: number) {
    const z = this.cam.zoom;
    return { x: (wx - this.cam.scrollX - this.w / 2) * z + this.w / 2, y: (wy - this.cam.scrollY - this.h / 2) * z + this.h / 2 };
  }

  mouseWorld() { return this.toWorld(this.sx, this.sy - this.fingerOffset); }

  setMouse(sx: number, sy: number) { this.sx = sx; this.sy = sy; }

  centerOn(wx: number, wy: number) {
    this.cam.scrollX = wx - this.w / 2;
    this.cam.scrollY = wy - this.h / 2;
    this.clamp();
  }

  /** Arrasta o mapa: (dx, dy) é quanto o dedo andou na tela. */
  panBy(dx: number, dy: number) {
    this.cam.scrollX -= dx / this.cam.zoom;
    this.cam.scrollY -= dy / this.cam.zoom;
    this.clamp();
  }

  private setZoom(z: number) {
    this.cam.setZoom(Phaser.Math.Clamp(z, this.minZoom, ZOOM_MAX));
    this.clamp();
  }

  private zoomBy(deltaY: number, mx: number, my: number) {
    const before = this.toWorld(mx, my);
    this.setZoom(this.cam.zoom * Math.exp(-deltaY * 0.0012));
    const after = this.toWorld(mx, my);
    // mantém o ponto sob o mouse no mesmo lugar
    this.cam.scrollX += before.x - after.x;
    this.cam.scrollY += before.y - after.y;
    this.clamp();
  }

  private onTouches(e: TouchEvent, start: boolean) {
    if (e.touches.length < 2) {
      if (!start) return;
      this.touches.clear();
      for (const t of Array.from(e.touches)) this.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      return;
    }
    e.preventDefault();
    const a = e.touches[0], b = e.touches[1];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    if (start || this.touches.size < 2) {
      // o segundo dedo acabou de entrar
      this.touches.set(a.identifier, { x: a.clientX, y: a.clientY });
      this.touches.set(b.identifier, { x: b.clientX, y: b.clientY });
      this.pinchDist = dist;
      this.pinchMid = mid;
      this.onMulti?.();
      return;
    }
    // a pinça muda o zoom; o ponto entre os dedos acompanha, então dá para mover junto
    const anchor = this.toWorld(this.pinchMid.x, this.pinchMid.y);
    this.setZoom(this.cam.zoom * (dist / Math.max(1, this.pinchDist)));
    const now = this.toWorld(mid.x, mid.y);
    this.cam.scrollX += anchor.x - now.x;
    this.cam.scrollY += anchor.y - now.y;
    this.clamp();
    this.pinchDist = dist;
    this.pinchMid = mid;
  }

  /** não deixa a câmera sair do mapa */
  private clamp() {
    const z = this.cam.zoom, vw = this.w / z, vh = this.h / z;
    const minX = vw / 2 - this.w / 2, maxX = WORLD_W - vw / 2 - this.w / 2;
    const minY = vh / 2 - this.h / 2, maxY = WORLD_H + barH() - vh / 2 - this.h / 2;
    this.cam.scrollX = minX > maxX ? (minX + maxX) / 2 : Phaser.Math.Clamp(this.cam.scrollX, minX, maxX);
    this.cam.scrollY = minY > maxY ? (minY + maxY) / 2 : Phaser.Math.Clamp(this.cam.scrollY, minY, maxY);
  }

  update(dt: number) {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k) {
      if (k.A.isDown || k.LEFT.isDown) dx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) dx += 1;
      if (k.W.isDown || k.UP.isDown) dy -= 1;
      if (k.S.isDown || k.DOWN.isDown) dy += 1;
    }
    // mouse encostado na borda da janela
    if (this.inside) {
      if (this.sx <= EDGE_SCROLL_PX) dx -= 1;
      if (this.sx >= this.w - EDGE_SCROLL_PX) dx += 1;
      if (this.sy <= EDGE_SCROLL_PX) dy -= 1;
      if (this.sy >= this.h - EDGE_SCROLL_PX) dy += 1;
    }
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const v = SCROLL_SPEED / this.cam.zoom * dt;
      this.cam.scrollX += dx / len * v;
      this.cam.scrollY += dy / len * v;
      this.clamp();
    }
  }
}
