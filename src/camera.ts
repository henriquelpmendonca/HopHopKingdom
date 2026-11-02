import Phaser from 'phaser';
import { BAR_H, EDGE_SCROLL_PX, SCROLL_SPEED, WORLD_H, WORLD_W, ZOOM_MAX } from './config';

/**
 * Câmera estilo Warcraft 3: o mapa é maior que a tela.
 * - roda do mouse: zoom (em direção ao mouse)
 * - mouse nas bordas da janela ou setas/WASD: move a câmera
 * Faz as contas de tela <-> mundo à mão, para não depender do estado do quadro anterior.
 */
export class CameraRig {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  /** posição do mouse na janela (px) */
  private sx = 0;
  private sy = 0;
  private inside = false;

  constructor(private scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
    this.keys = scene.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;

    const move = (e: PointerEvent) => { this.sx = e.clientX; this.sy = e.clientY; this.inside = true; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', move);
    document.documentElement.addEventListener('mouseleave', () => { this.inside = false; });
    document.documentElement.addEventListener('mouseenter', () => { this.inside = true; });
    const canvasHost = document.getElementById('game')!;
    canvasHost.addEventListener('wheel', e => { e.preventDefault(); this.zoomBy(e.deltaY, e.clientX, e.clientY); }, { passive: false });
    scene.scale.on('resize', () => this.setZoom(this.cam.zoom));
    this.setZoom(1);
  }

  private get w() { return this.scene.scale.width; }
  private get h() { return this.scene.scale.height; }

  get zoom() { return this.cam.zoom; }

  /** menor zoom em que o mapa ainda preenche a tela inteira */
  private get minZoom() { return Math.max(this.w / WORLD_W, this.h / (WORLD_H + BAR_H)); }

  toWorld(sx: number, sy: number) {
    const z = this.cam.zoom;
    return { x: this.cam.scrollX + this.w / 2 + (sx - this.w / 2) / z, y: this.cam.scrollY + this.h / 2 + (sy - this.h / 2) / z };
  }

  toScreen(wx: number, wy: number) {
    const z = this.cam.zoom;
    return { x: (wx - this.cam.scrollX - this.w / 2) * z + this.w / 2, y: (wy - this.cam.scrollY - this.h / 2) * z + this.h / 2 };
  }

  mouseWorld() { return this.toWorld(this.sx, this.sy); }

  setMouse(sx: number, sy: number) { this.sx = sx; this.sy = sy; }

  centerOn(wx: number, wy: number) {
    this.cam.scrollX = wx - this.w / 2;
    this.cam.scrollY = wy - this.h / 2;
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

  /** não deixa a câmera sair do mapa */
  private clamp() {
    const z = this.cam.zoom, vw = this.w / z, vh = this.h / z;
    const minX = vw / 2 - this.w / 2, maxX = WORLD_W - vw / 2 - this.w / 2;
    const minY = vh / 2 - this.h / 2, maxY = WORLD_H + BAR_H - vh / 2 - this.h / 2;
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
