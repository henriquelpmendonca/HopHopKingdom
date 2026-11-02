import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { setupHud } from './ui/Hud';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#cfe8a8',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [BootScene, GameScene],
});

setupHud();

// só no modo de desenvolvimento: ajuda a inspecionar o jogo pelo console
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
