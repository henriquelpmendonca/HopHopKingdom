import Phaser from 'phaser';
import { bakeTextures } from '../textures';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const bar = document.getElementById('loadBar');
    this.load.on('progress', (v: number) => { if (bar) bar.style.width = Math.round(v * 100) + '%'; });
    this.load.image('castelo', 'assets/castelo.png');
    this.load.image('castelo_2', 'assets/castelo_2.png');
    this.load.image('castelo_3', 'assets/castelo_3.png');
    this.load.image('castelo_4', 'assets/castelo_4.png');
    this.load.image('castelo_5', 'assets/castelo_5.png');
    this.load.image('soldado', 'assets/soldado.png');
    this.load.image('espada', 'assets/espada.png');
    this.load.image('espada_2', 'assets/espada_2.png');
    this.load.image('espada_3', 'assets/espada_3.png');
    this.load.image('espada_4', 'assets/espada_4.png');
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
    // soldados especiais, baú e explosão
    for (const n of ['cabana_estudo_1', 'cabana_gigante_1', 'cabana_bomba_1', 'cabana_quicador_1', 'boss2', 'soldado_gelo', 'cabana_gelo_1', 'castelo_6', 'soldado_bomba', 'soldado_gigante', 'soldado_quicador', 'bau', 'bau_aberto', 'explosao']) this.load.image(n, `assets/${n}.png`);
    this.load.image('soldado_lanca', 'assets/soldado_lanca.png');
    this.load.image('soldado_alabarda', 'assets/soldado_alabarda.png');
    this.load.image('cabana_arqueiro_1', 'assets/cabana_arqueiro_1.png');
    this.load.image('arqueiro', 'assets/arqueiro.png');
    this.load.image('arqueiro_2', 'assets/arqueiro_2.png');
    this.load.image('arqueiro_3', 'assets/arqueiro_3.png');
    this.load.image('cabana_arqueiro_3', 'assets/cabana_arqueiro_3.png');
    this.load.image('cabana_arqueiro_2', 'assets/cabana_arqueiro_2.png');
    for (let i = 1; i <= 3; i++) this.load.image('cabana_mago_' + i, `assets/cabana_mago_${i}.png`);
    for (let i = 1; i <= 3; i++) this.load.image('mago_aliado_' + i, `assets/mago_aliado_${i}.png`);
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
