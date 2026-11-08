import Phaser from 'phaser';

/**
 * Imagens pequenas desenhadas uma vez só, no começo, e reaproveitadas por todo o jogo.
 * Formas desenhadas a cada quadro (elipses, círculos, textos) pesam muito no celular;
 * imagens prontas são agrupadas pela placa de vídeo e custam quase nada.
 */
export const DIGIT_CHARS = '0123456789+';
export const DIGIT_CELL = { w: 30, h: 40, advance: 19 };

export type DigitSet = 'dg_white' | 'dg_red' | 'dg_gold';

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return null;
  draw(tex.getContext());
  tex.refresh();
  return tex;
}

function digits(scene: Phaser.Scene, key: DigitSet, fill: string, stroke: string) {
  const { w, h } = DIGIT_CELL;
  const tex = make(scene, key, w * DIGIT_CHARS.length, h, ctx => {
    ctx.font = '900 30px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    [...DIGIT_CHARS].forEach((ch, i) => {
      ctx.strokeText(ch, i * w + w / 2, h / 2 + 1);
      ctx.fillText(ch, i * w + w / 2, h / 2 + 1);
    });
  });
  if (tex) [...DIGIT_CHARS].forEach((ch, i) => tex.add(ch, 0, i * w, 0, w, h));
}

export function bakeTextures(scene: Phaser.Scene) {
  // mancha macia: sombras e brilhos
  make(scene, 'soft', 64, 64, ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  // bolinha das partículas (a cor vem do tint)
  make(scene, 'dot', 16, 16, ctx => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(8, 8, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  // três manchas de sangue achatadas, para parecerem no chão
  for (let k = 0; k < 3; k++) {
    make(scene, 'blood' + k, 96, 56, ctx => {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) {
        const x = 48 + (Math.random() - 0.5) * 58, y = 28 + (Math.random() - 0.5) * 26, r = 4 + Math.random() * 10;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.2, r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  // escombros de uma cabana destruída: pedras e tábuas (voltam a ser cabana quando a onda acaba)
  make(scene, 'ruina', 160, 84, ctx => {
    ctx.lineJoin = 'round';
    const stones: [number, number, number, number][] = [[34, 62, 26, 15], [70, 56, 30, 19], [108, 62, 26, 15], [54, 44, 20, 13], [92, 42, 22, 14], [128, 70, 18, 11], [20, 72, 16, 10]];
    // tábuas quebradas
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2] of [[28, 50, 72, 26], [96, 28, 138, 54], [60, 30, 104, 44]]) {
      ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = '#b07a46'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    for (const [x, y, rx, ry] of stones) {
      ctx.fillStyle = '#5a5248'; ctx.beginPath(); ctx.ellipse(x, y, rx + 3, ry + 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b9b1a3'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ddd6c8'; ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
  });
  // números de dano e moedas: um desenho de cada dígito, em vez de um texto novo a cada golpe
  digits(scene, 'dg_white', '#ffffff', '#7a1409');
  digits(scene, 'dg_red', '#ff5a4d', '#4a0d08');
  digits(scene, 'dg_gold', '#ffd84a', '#5a3418');
}
