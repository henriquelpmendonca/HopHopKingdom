import { bus, Evt } from '../events';
import { swordTier } from '../data/sword';

/**
 * A espada é o cursor da página inteira.
 *
 * Em vez de usar o cursor do navegador (que some perto das bordas da janela quando a imagem é
 * grande, justo em cima da barra de construção), a espada é uma imagem que segue o mouse.
 * Assim ela pode ser de qualquer tamanho e girar de verdade em volta do cabo ao clicar.
 * O desenho muda conforme o nível da espada (data/sword.ts).
 */
const REST = -45;                  // graus: ponta para cima e para a esquerda

export function setupSwordCursor() {
  let H = 60, W = 28, L = 47;      // tamanho, largura e distância cabo-ponta da espada atual
  let offset = L * Math.SQRT1_2;   // o cabo fica deslocado da ponta, para a ponta ser o ponto do clique

  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '1000', display: 'none', willChange: 'transform',
  });
  const img = document.createElement('img');
  img.draggable = false;
  img.style.position = 'absolute';
  img.style.filter = 'drop-shadow(0 3px 2px rgba(0,0,0,.35))';
  wrap.appendChild(img);
  document.body.appendChild(wrap);

  // luva: o cursor de sempre; a espada só aparece em cima de um inimigo (onde o clique ataca)
  const glove = document.createElement('img');
  glove.src = 'assets/luva.png';
  glove.draggable = false;
  Object.assign(glove.style, {
    position: 'fixed', left: '-3px', top: '-2px', width: '79px', height: '88px', pointerEvents: 'none', zIndex: '1000',
    display: 'none', willChange: 'transform', transformOrigin: '3px 2px',
    filter: 'drop-shadow(0 3px 2px rgba(0,0,0,.35))',
  });
  document.body.appendChild(glove);
  let overFoe = false, onCanvas = false, visible = false;
  const mode = () => {
    const sword = overFoe && onCanvas;
    wrap.style.display = visible && sword ? 'block' : 'none';
    glove.style.display = visible && !sword ? 'block' : 'none';
  };
  bus.on(Evt.OverEnemy, (v: boolean) => { overFoe = v; mode(); });

  function apply(level: number) {
    const t = swordTier(level);
    H = t.height;
    W = Math.round(H * t.aspect);
    L = Math.round(H * t.pivot);
    offset = L * Math.SQRT1_2;
    img.src = `assets/${t.art}.png`;
    Object.assign(img.style, {
      left: `${-W / 2}px`, top: `${-L}px`, width: `${W}px`, height: `${H}px`,
      transformOrigin: `${W / 2}px ${L}px`, transform: `rotate(${REST}deg)`,
    });
  }
  apply(1);
  bus.on(Evt.Sword, (level: number) => apply(level));

  let lastX = 0, lastY = 0, pressed = false;
  const place = () => { wrap.style.transform = `translate(${lastX + offset}px, ${lastY + offset}px)`; };
  const move = (e: PointerEvent) => {
    // no celular não existe cursor: o golpe aparece direto no mapa
    if (e.pointerType === 'touch') { visible = false; mode(); return; }
    visible = true;
    onCanvas = (e.target as HTMLElement | null)?.tagName === 'CANVAS';
    lastX = e.clientX;
    lastY = e.clientY;
    place();
    glove.style.transform = `translate(${lastX}px, ${lastY}px) ${pressed ? 'scale(.86) rotate(-8deg)' : ''}`;
    mode();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerdown', e => {
    move(e);
    if (e.pointerType === 'touch') return;
    pressed = true;
    glove.style.transform = `translate(${lastX}px, ${lastY}px) scale(.86) rotate(-8deg)`;
    // golpe: a espada gira em volta do cabo, passando por cima do ponto do clique
    img.animate([
      { transform: `rotate(${REST}deg)` },
      { transform: 'rotate(-15deg)', offset: 0.15 },
      { transform: 'rotate(18deg)', offset: 0.4 },
      { transform: 'rotate(40deg)', offset: 0.65 },
      { transform: `rotate(${REST}deg)` },
    ], { duration: 280, easing: 'ease-out' });
  });
  window.addEventListener('pointerup', () => { pressed = false; glove.style.transform = `translate(${lastX}px, ${lastY}px)`; });
  document.documentElement.addEventListener('mouseleave', () => { visible = false; mode(); });
}
