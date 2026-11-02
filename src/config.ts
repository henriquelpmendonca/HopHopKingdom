export const CASTLE_W = 420;
export const SOLDIER_H = 46;
export const GRAVITY = 1500;
export const MAX_THROW_SPEED = 2600;
/** altura da barra de construção no rodapé (px) */
export const BAR_H = 130;
/** tamanho do mapa (px); a tela mostra só um pedaço, como no Warcraft 3 */
export const WORLD_W = 2400;
export const WORLD_H = 1500;
export const ZOOM_MAX = 1.6;
/** faixa (px) na borda da janela que move a câmera */
export const EDGE_SCROLL_PX = 26;
export const SCROLL_SPEED = 950;
export const START_COINS = 100;
/** dano de cada clique num inimigo: base + bônus por nível do centro da vila */
export const CLICK_DAMAGE = 8;
export const CLICK_DAMAGE_PER_CASTLE_LEVEL = 4;
/** o clique também machuca quem está pertinho (raio em px do mapa) com esta fração do dano */
export const CLICK_AOE_RADIUS = 60;
export const CLICK_AOE_MULT = 0.6;
/**
 * Cursor de espada sobre os inimigos. O navegador não anima cursor, então são 4 imagens:
 * 0 = parada, 1 a 3 = a espada girando em volta da mão, como num golpe.
 * O ponto do clique (21,21) é onde a ponta fica quando a espada está parada.
 */
// endereço completo: o CSS troca o cursor da página inteira (mapa, botões e cartas) por uma variável
export const SWORD_CURSORS = [0, 1, 2, 3].map(i => `url(${new URL(`assets/espada_cursor_${i}.png`, document.baseURI).href}) 21 21, auto`);
/** quadro do cursor segundo o tempo (s) desde o clique */
export function swordFrame(t: number) {
  if (t < 0.04) return 1;
  if (t < 0.09) return 2;
  if (t < 0.17) return 3;
  if (t < 0.24) return 1;
  return 0;
}
export const COLORS = { grass: 0xcfe8a8, grassTile: 0xb9d98e };
