import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { audio, unlockAudio } from './audio';
import { setupHud } from './ui/Hud';
import { setupSwordCursor } from './ui/SwordCursor';
import { sdk } from './sdk';
import { applyStaticTexts, setLocale } from './i18n';

async function start() {
  await sdk.init();
  sdk.loadingStart();
  setLocale(sdk.locale);
  applyStaticTexts();
  audio.loadPrefs();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#cfe8a8',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [BootScene, GameScene],
  });

  setupHud();
  setupSwordCursor();
  unlockAudio();

  // pausa o jogo (e o som) durante anúncios e quando a aba fica escondida
  let adPause = false;
  let hidden = false;
  const apply = () => {
    const stop = adPause || hidden;
    const scene = game.scene.getScene('Game');
    if (game.scene.isActive('Game') && stop) game.scene.pause('Game');
    else if (!stop && game.scene.isPaused('Game')) game.scene.resume('Game');
    audio.duck(stop);
    if (scene) sdk.setPlaying(!stop && !(scene as GameScene).isOver());
  };
  sdk.onPause(on => { adPause = on; apply(); });
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; apply(); });

  // só no modo de desenvolvimento: ajuda a inspecionar o jogo pelo console
  if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
}

void start();
