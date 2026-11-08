import Phaser from 'phaser';
import { WORLD_H, WORLD_W } from './config';
import { footprint, type Building } from './entities/Building';

/**
 * Cenário minimalista: tufos de grama, flores, pedrinhas, moitas e árvores que balançam com o vento.
 * Tudo desenhado uma vez em textura (nada de arte nova) e animado só o que está na tela.
 * Uma construção nova tira o que estiver embaixo dela.
 */
type Kind = 'tuft' | 'flower' | 'stone' | 'bush' | 'tree';

interface Item {
  img: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
  kind: Kind;
  amp: number;
  speed: number;
  phase: number;
}

const OUT = '#6f8a4e';

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  const c = t.getContext();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  t.refresh();
}

/** círculos com contorno escuro grosso, no estilo do jogo */
function blobs(c: CanvasRenderingContext2D, list: [number, number, number][], fill: string, light: string) {
  c.fillStyle = OUT;
  for (const [x, y, r] of list) { c.beginPath(); c.arc(x, y, r + 3.5, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = fill;
  for (const [x, y, r] of list) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = light;
  for (const [x, y, r] of list) { c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.42, 0, Math.PI * 2); c.fill(); }
}

function bake(scene: Phaser.Scene) {
  // tufos de grama: folhas curvas, com a ponta mais clara
  for (let v = 0; v < 2; v++) {
    tex(scene, 'dc_tuft' + v, 44, 36, c => {
      const blades = v ? [[-12, -0.5], [-5, -0.15], [3, 0.2], [11, 0.55]] : [[-9, -0.35], [0, 0.05], [9, 0.45]];
      for (const pass of [0, 1]) {
        for (const [dx, lean] of blades) {
          const bx = 22 + dx, tipX = bx + lean * 18, tipY = 4 + Math.abs(dx) * 0.6;
          c.beginPath();
          c.moveTo(bx - 5, 35);
          c.quadraticCurveTo(bx - 3 + lean * 6, 18, tipX, tipY);
          c.quadraticCurveTo(bx + 3 + lean * 6, 18, bx + 5, 35);
          c.closePath();
          if (pass === 0) { c.strokeStyle = OUT; c.lineWidth = 4; c.stroke(); } else {
            const g = c.createLinearGradient(0, 35, 0, tipY);
            g.addColorStop(0, '#8db86a');
            g.addColorStop(1, '#cde8a8');
            c.fillStyle = g;
            c.fill();
          }
        }
      }
    });
  }
  // flores: três cores
  ['#f7a3b8', '#f6e08a', '#ffffff'].forEach((col, i) => {
    tex(scene, 'dc_flower' + i, 26, 34, c => {
      c.strokeStyle = OUT; c.lineWidth = 5;
      c.beginPath(); c.moveTo(13, 33); c.quadraticCurveTo(11, 22, 13, 13); c.stroke();
      c.strokeStyle = '#9cc47c'; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(13, 33); c.quadraticCurveTo(11, 22, 13, 13); c.stroke();
      const petals: [number, number, number][] = [];
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; petals.push([13 + Math.cos(a) * 5.5, 11 + Math.sin(a) * 5.5, 4.2]); }
      blobs(c, petals, col, 'rgba(255,255,255,.55)');
      c.fillStyle = i === 1 ? '#f2b66a' : '#f4d978';
      c.beginPath(); c.arc(13, 11, 3.6, 0, Math.PI * 2); c.fill();
    });
  });
  // pedrinha
  tex(scene, 'dc_stone', 44, 30, c => {
    c.fillStyle = '#5a5248';
    c.beginPath(); c.ellipse(22, 17, 19, 11, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b9b1a3';
    c.beginPath(); c.ellipse(22, 16, 16, 8.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ddd6c8';
    c.beginPath(); c.ellipse(17, 13, 6, 3, -0.3, 0, Math.PI * 2); c.fill();
  });
  // moita
  tex(scene, 'dc_bush', 84, 58, c => {
    blobs(c, [[22, 36, 16], [42, 28, 20], [62, 36, 16], [42, 42, 15]], '#9cc77e', '#c4e3a8');
  });
  // árvore redonda e árvore de pinheiro
  tex(scene, 'dc_tree0', 120, 160, c => {
    c.fillStyle = '#7d6a52'; c.fillRect(49, 92, 22, 66);
    c.fillStyle = '#b08f6c'; c.fillRect(53, 92, 14, 64);
    c.fillStyle = '#c9aa86'; c.fillRect(55, 96, 4, 56);
    blobs(c, [[36, 70, 28], [84, 70, 28], [60, 48, 34], [60, 84, 26]], '#94c47a', '#c0e0a4');
  });
  tex(scene, 'dc_tree1', 104, 168, c => {
    c.fillStyle = '#7d6a52'; c.fillRect(43, 120, 18, 46);
    c.fillStyle = '#a8876a'; c.fillRect(47, 120, 10, 44);
    for (const pass of [0, 1]) {
      [[130, 46], [96, 38], [62, 28]].forEach(([y, hw], k) => {
        c.beginPath();
        c.moveTo(52 - hw, y); c.lineTo(52, y - 52 + k * 4); c.lineTo(52 + hw, y); c.closePath();
        if (pass === 0) { c.strokeStyle = OUT; c.lineWidth = 7; c.stroke(); } else { c.fillStyle = k === 2 ? '#9ac47f' : '#87b56d'; c.fill(); }
      });
    }
    c.fillStyle = 'rgba(214,238,190,.6)';
    c.beginPath(); c.moveTo(40, 116); c.lineTo(52, 84); c.lineTo(50, 116); c.closePath(); c.fill();
  });
}

/** sorteio fixo: o cenário é sempre o mesmo */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

export class Scenery {
  private items: Item[] = [];
  private t = 0;

  constructor(private scene: Phaser.Scene, cx: number, cy: number) {
    bake(scene);
    const r = rng(20261108);
    // manchas de grama mais escura no chão: quebram o xadrez sem chamar atenção
    for (let i = 0; i < 46; i++) {
      scene.add.image(r() * WORLD_W, r() * WORLD_H, 'soft').setTint(0xa9cf86).setAlpha(0.16)
        .setScale(6 + r() * 7, 3 + r() * 3).setDepth(-900_000);
    }
    const far = (x: number, y: number, d: number) => Math.hypot(x - cx, (y - cy) * 1.3) > d;
    const put = (kind: Kind, n: number, minD: number, key: () => string, scale: () => number) => {
      let tries = 0;
      for (let i = 0; i < n && tries < n * 20; tries++) {
        const x = 40 + r() * (WORLD_W - 80), y = 90 + r() * (WORLD_H - 100);
        if (!far(x, y, minD)) continue;
        i++;
        const img = this.scene.add.image(x, y, key()).setOrigin(0.5, 1).setScale(scale()).setDepth(y);
        if (r() < 0.5) img.setFlipX(true);
        let shadow: Phaser.GameObjects.Image | undefined;
        if (kind === 'tree' || kind === 'bush') {
          shadow = this.scene.add.image(x, y - 4, 'soft').setTint(0x56743a).setAlpha(0.22)
            .setScale(img.displayWidth / 64 * 1.1, img.displayWidth / 64 * 0.35).setDepth(-400_000);
        }
        const amp = kind === 'tuft' ? 0.16 : kind === 'flower' ? 0.13 : kind === 'tree' ? 0.03 : kind === 'bush' ? 0.02 : 0;
        this.items.push({ img, shadow, kind, amp, speed: 1.6 + r() * 1.2, phase: r() * Math.PI * 2 });
      }
    };
    put('tuft', 340, 330, () => 'dc_tuft' + (r() < 0.5 ? 0 : 1), () => 0.8 + r() * 0.6);
    put('flower', 120, 360, () => 'dc_flower' + Math.floor(r() * 3), () => 0.8 + r() * 0.5);
    put('stone', 40, 420, () => 'dc_stone', () => 0.6 + r() * 0.7);
    put('bush', 50, 520, () => 'dc_bush', () => 0.8 + r() * 0.5);
    put('tree', 70, 640, () => 'dc_tree' + (r() < 0.6 ? 0 : 1), () => 0.85 + r() * 0.5);
  }

  /** tira o cenário que ficou embaixo de uma construção */
  clearUnder(b: Building) {
    const f = footprint(b);
    this.items = this.items.filter(it => {
      const { x, y } = it.img;
      const pad = it.kind === 'tree' ? 50 : 20;
      if (x > f.l - pad && x < f.r + pad && y > f.t - pad && y < f.b + pad * 2) {
        it.img.destroy();
        it.shadow?.destroy();
        return false;
      }
      return true;
    });
  }

  /** vento: só o que está na tela se mexe */
  update(dt: number, view: Phaser.Geom.Rectangle) {
    this.t += dt;
    const gust = 0.75 + 0.35 * Math.sin(this.t * 0.45) + 0.2 * Math.sin(this.t * 1.3);
    const l = view.x - 120, r = view.right + 120, top = view.y - 40, bottom = view.bottom + 200;
    for (const it of this.items) {
      if (!it.amp) continue;
      const { img } = it;
      if (img.x < l || img.x > r || img.y < top || img.y > bottom) continue;
      // a onda do vento passa da esquerda para a direita
      img.rotation = Math.sin(this.t * it.speed + it.phase - img.x * 0.004) * it.amp * gust;
    }
  }
}
