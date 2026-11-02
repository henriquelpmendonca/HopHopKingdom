/**
 * Setas nas bordas da tela apontando os inimigos que estão fora de vista.
 * O mapa é grande: sem isto, um orc atacando uma mina longe passa despercebido.
 * Desenha num canvas por cima do jogo (só até 16 setas, quase não pesa).
 */
interface Blip { x: number; y: number; hot: boolean; boss: boolean }

export class Radar {
  private cv = document.createElement('canvas');
  private ctx = this.cv.getContext('2d')!;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private t = 0;

  constructor() {
    Object.assign(this.cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '3' });
    document.body.appendChild(this.cv);
  }

  private fit(w: number, h: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.cv.width = w * dpr;
    this.cv.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** `bar` é a altura da barra de construção: as setas ficam acima dela. */
  draw(blips: Blip[], w: number, h: number, bar: number) {
    this.fit(w, h);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    this.t += 0.016;
    const m = 30, top = 70;
    const cx = w / 2, cy = (top + h - bar) / 2;
    const hw = w / 2 - m, hh = (h - bar - top) / 2 - m / 2;

    // só os inimigos fora da área visível; os que atacam construções primeiro
    const off = blips.filter(b => b.x < 0 || b.x > w || b.y < top || b.y > h - bar)
      .sort((a, b) => Number(b.boss) - Number(a.boss) || Number(b.hot) - Number(a.hot))
      .slice(0, 16);
    for (const b of off) {
      const vx = b.x - cx, vy = b.y - cy;
      const k = Math.min(hw / Math.max(1, Math.abs(vx)), hh / Math.max(1, Math.abs(vy)));
      const px = cx + vx * k, py = cy + vy * k;
      const ang = Math.atan2(vy, vx);
      const size = b.boss ? 20 : 13;
      const pulse = b.hot ? 0.75 + 0.25 * Math.sin(this.t * 9) : 0.85;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.7, size * 0.8);
      ctx.lineTo(-size * 0.35, 0);
      ctx.lineTo(-size * 0.7, -size * 0.8);
      ctx.closePath();
      ctx.fillStyle = b.boss ? '#7a1fd1' : b.hot ? '#ff2d2d' : '#ff9a2d';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
    }
  }
}
