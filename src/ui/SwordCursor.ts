/**
 * A espada é o cursor da página inteira.
 *
 * Em vez de usar o cursor do navegador (que some perto das bordas da janela quando a imagem é
 * grande, justo em cima da barra de construção), a espada é uma imagem que segue o mouse.
 * Assim ela pode ser de qualquer tamanho e girar de verdade em volta do cabo ao clicar.
 */
const H = 60;                      // altura da espada na tela (px)
const W = Math.round(H * 148 / 320);
const L = Math.round(H * 0.78);    // do cabo (onde a mão segura) até a ponta
const REST = -45;                  // graus: ponta para cima e para a esquerda
// o cabo fica deslocado da ponta, para que a ponta seja o ponto do clique
const OFFSET = L * Math.SQRT1_2;

export function setupSwordCursor() {
  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '1000', display: 'none', willChange: 'transform',
  });
  const img = document.createElement('img');
  img.src = 'assets/espada.png';
  img.draggable = false;
  Object.assign(img.style, {
    position: 'absolute', left: `${-W / 2}px`, top: `${-L}px`, width: `${W}px`, height: `${H}px`,
    transformOrigin: `${W / 2}px ${L}px`, transform: `rotate(${REST}deg)`, filter: 'drop-shadow(0 3px 2px rgba(0,0,0,.35))',
  });
  wrap.appendChild(img);
  document.body.appendChild(wrap);

  const move = (e: PointerEvent) => {
    // no celular não existe cursor: o golpe aparece direto no mapa
    if (e.pointerType === 'touch') { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    wrap.style.transform = `translate(${e.clientX + OFFSET}px, ${e.clientY + OFFSET}px)`;
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerdown', e => {
    move(e);
    if (e.pointerType === 'touch') return;
    // golpe: a espada gira em volta do cabo, passando por cima do ponto do clique
    img.animate([
      { transform: `rotate(${REST}deg)` },
      { transform: 'rotate(-15deg)', offset: 0.15 },
      { transform: 'rotate(18deg)', offset: 0.4 },
      { transform: 'rotate(40deg)', offset: 0.65 },
      { transform: `rotate(${REST}deg)` },
    ], { duration: 280, easing: 'ease-out' });
  });
  document.documentElement.addEventListener('mouseleave', () => { wrap.style.display = 'none'; });
}
