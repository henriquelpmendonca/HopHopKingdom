import Phaser from 'phaser';
import { bakeTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('castelo', 'assets/castelo.png');
    this.load.image('castelo_2', 'assets/castelo_2.png');
    this.load.image('castelo_3', 'assets/castelo_3.png');
    this.load.image('soldado', 'assets/soldado.png');
    this.load.image('espada', 'assets/espada.png');
    this.load.image('espada_2', 'assets/espada_2.png');
    this.load.image('espada_3', 'assets/espada_3.png');
    this.load.image('orc', 'assets/orc.png');
    this.load.image('orc2', 'assets/orc2.png');
    this.load.image('orc3', 'assets/orc3.png');
    this.load.image('boss', 'assets/boss.png');
    this.load.image('mago', 'assets/mago.png');
    this.load.image('mago2', 'assets/mago2.png');
    this.load.image('mago3', 'assets/mago3.png');
    this.load.image('esqueleto', 'assets/esqueleto.png');
    // desenhos opcionais: se o arquivo ainda não existir, o jogo usa o soldado de espada
    this.load.on('loaderror', () => {});
    this.load.image('soldado_lanca', 'assets/soldado_lanca.png');
    this.load.image('soldado_alabarda', 'assets/soldado_alabarda.png');
    this.load.image('cabana_arqueiro_1', 'assets/cabana_arqueiro_1.png');
    this.load.image('arqueiro', 'assets/arqueiro.png');
    this.load.image('arqueiro_2', 'assets/arqueiro_2.png');
    this.load.image('arqueiro_3', 'assets/arqueiro_3.png');
    this.load.image('cabana_arqueiro_3', 'assets/cabana_arqueiro_3.png');
    this.load.image('cabana_arqueiro_2', 'assets/cabana_arqueiro_2.png');
    for (let i = 1; i <= 3; i++) this.load.image('cabana_mago_' + i, `assets/cabana_mago_${i}.png`);
    this.load.image('mina_mana_1', 'assets/mina_mana_1.png');
    this.load.image('mina_mana_2', 'assets/mina_mana_2.png');
    this.load.image('mina_mana_3', 'assets/mina_mana_3.png');
    this.load.image('mina_ouro_1', 'assets/mina_ouro_1.png');
    this.load.image('mina_ouro_2', 'assets/mina_ouro_2.png');
    this.load.image('mina_ouro_3', 'assets/mina_ouro_3.png');
    for (let i = 1; i <= 3; i++) this.load.image('cabana_soldado_' + i, `assets/cabana_soldado_${i}.png`);
  }

  create() {
    bakeTextures(this);
    this.scene.start('Game');
  }
}
