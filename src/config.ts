export const CASTLE_W = 420;
export const SOLDIER_H = 46;
export const GRAVITY = 1500;
export const MAX_THROW_SPEED = 2600;
/** altura da barra de construção no rodapé (px); muda no celular, por isso lê da própria barra */
export const barH = () => document.getElementById('bar')?.offsetHeight ?? 130;
/** tamanho do mapa (px); a tela mostra só um pedaço, como no Warcraft 3 */
export const WORLD_W = 4800;
export const WORLD_H = 3000;
export const ZOOM_MAX = 1.6;
/** faixa (px) na borda da janela que move a câmera */
export const EDGE_SCROLL_PX = 26;
export const SCROLL_SPEED = 1300;
export const START_COINS = 100;
/** multiplicador das moedas que os inimigos dão ao morrer */
export const KILL_COIN_MULT = 0.7;
/** ao reerguer a cidade depois de perder: fração das moedas que fica e quantas ondas voltam (um quinto, no mínimo 2) */
export const REBUILD_COIN_KEEP = 0.7;
export const rebuildBack = (wave: number) => Math.max(2, Math.ceil(wave * 0.2));
/** as cabanas derrubadas nas últimas ondas voltam, inteiras, quando a cidade é reerguida */
export const REBUILD_HUT_WAVES = 4;
/** o clique também machuca quem está pertinho, com esta fração do dano (dano e raio vêm da espada: data/sword.ts) */
export const CLICK_AOE_MULT = 0.6;

export const COLORS = { grass: 0xcfe8a8, grassTile: 0xb9d98e };

/** vender uma cabana devolve esta fração do que ela valeu; movê-la custa esta fração (só entre ondas) */
export const SELL_REFUND = 0.6;
export const MOVE_COST = 0.1;
