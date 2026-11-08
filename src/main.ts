import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { audio, unlockAudio } from './audio';
import { setupHud } from './ui/Hud';
import { setupTutorial } from './ui/Tutorial';
import { setupForge } from './ui/Forge';
import { setupLangMenu } from './ui/LangMenu';
import { setupBanner } from './ui/Banner';
import { setupSwordCursor } from './ui/SwordCursor';
import { sdk } from './sdk';
import { bus, Evt } from './events';
import { applyStaticTexts, savedLang, setLocale } from './i18n';

async function start() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('novo')) {
    for (const k of ['hophopkingdom_save', 'hhk_tuto']) localStorage.removeItem(k);
  }
  (document.getElementById('loadLogo') as HTMLImageElement).src = 'assets/logo.png';
  await sdk.init();
  sdk.loadingStart();
  // idioma do jogador pelo SDK do portal; fora deles (ou sem idioma) é inglês. ?lang=pt ou ?lang=en força um
  setLocale(new URLSearchParams(location.search).get('lang') ?? savedLang() ?? (sdk.active ? sdk.locale : 'en'));
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
  setupTutorial();
  setupForge();
  setupLangMenu();
  setupBanner();
  setupSwordCursor();
  unlockAudio();

  // pausa o jogo (e o som) durante anúncios e quando a aba fica escondida
  let adPause = false;
  let hidden = false;
  let userPause = false;
  const apply = () => {
    const stop = adPause || hidden || userPause;
    const scene = game.scene.getScene('Game');
    if (game.scene.isActive('Game') && stop) game.scene.pause('Game');
    else if (!stop && game.scene.isPaused('Game')) game.scene.resume('Game');
    audio.duck(adPause || hidden || sdk.muted);
    if (scene) sdk.setPlaying(!stop && !(scene as GameScene).isOver());
  };
  sdk.onPause(on => { adPause = on; apply(); });
  sdk.onMute(() => apply());
  bus.on(Evt.Pause, (on: boolean) => { userPause = on; apply(); });
  if (sdk.muted) apply();
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; apply(); });

  // só no modo de desenvolvimento: ajuda a inspecionar o jogo pelo console
  if (import.meta.env.DEV) {
    (window as unknown as { __game: Phaser.Game }).__game = game;
    // testes de balanceamento: os mesmos módulos que o jogo usa
    void Promise.all([import('./data/cabanas'), import('./data/units'), import('./state'), import('./data/sword'), import('./data/castle')]).then(([cab, units, st, sword, castle]) => {
      (window as unknown as { __dev: object }).__dev = { cab, units, st, sword, castle };
    });
  }
}

void start();
