/**
 * Som do jogo, todo gerado por código com o Web Audio (nenhum arquivo de áudio).
 * - `sfx.*`: efeitos sonoros curtos
 * - `music.set(...)`: música em loop que troca conforme o que está acontecendo
 * O navegador só deixa tocar depois do primeiro clique, então tudo começa em `unlockAudio()`.
 */
const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Wave = OscillatorType;

interface ToneOpts {
  f: number;
  f2?: number;
  dur: number;
  type?: Wave;
  vol?: number;
  /** instante absoluto (ctx.currentTime); padrão: agora */
  when?: number;
  attack?: number;
  dest?: AudioNode;
}

interface NoiseOpts {
  dur: number;
  vol?: number;
  filter?: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  when?: number;
  dest?: AudioNode;
}

/** Uma barra da música: nota grave, acorde e a melodia (16 passos; 0 = pausa) */
interface Bar { root: number; chord: number[]; lead: number[] }

interface Track {
  bpm: number;
  bars: Bar[];
  bass: 'long' | 'drive' | 'gallop';
  arp: boolean;
  drums: 'soft' | 'rock' | 'heavy';
  lead: Wave;
  leadVol: number;
}

const TRACKS: Record<'calma' | 'batalha' | 'chefe', Track> = {
  // Dó maior, leve e alegre: para construir e juntar moedas
  calma: {
    bpm: 98, bass: 'long', arp: true, drums: 'soft', lead: 'square', leadVol: 0.05,
    bars: [
      { root: 36, chord: [60, 64, 67], lead: [76, 0, 0, 0, 79, 0, 0, 0, 81, 0, 79, 0, 76, 0, 0, 0] },
      { root: 33, chord: [57, 60, 64], lead: [72, 0, 0, 0, 76, 0, 0, 0, 79, 0, 76, 0, 72, 0, 0, 0] },
      { root: 29, chord: [53, 57, 60], lead: [77, 0, 0, 0, 81, 0, 0, 0, 84, 0, 81, 0, 77, 0, 0, 0] },
      { root: 31, chord: [55, 59, 62], lead: [79, 0, 0, 0, 83, 0, 0, 0, 86, 0, 83, 0, 79, 0, 76, 0] },
    ],
  },
  // Lá menor, ritmada: quando os orcs chegam
  batalha: {
    bpm: 138, bass: 'drive', arp: true, drums: 'rock', lead: 'square', leadVol: 0.055,
    bars: [
      { root: 33, chord: [57, 60, 64], lead: [81, 0, 81, 0, 84, 0, 81, 0, 79, 0, 76, 0, 79, 0, 81, 0] },
      { root: 29, chord: [53, 57, 60], lead: [77, 0, 77, 0, 81, 0, 77, 0, 76, 0, 72, 0, 76, 0, 77, 0] },
      { root: 36, chord: [60, 64, 67], lead: [79, 0, 79, 0, 83, 0, 79, 0, 76, 0, 72, 0, 76, 0, 79, 0] },
      { root: 31, chord: [55, 59, 62], lead: [74, 0, 74, 0, 79, 0, 83, 0, 81, 0, 79, 0, 74, 0, 71, 0] },
    ],
  },
  // Ré menor, pesada e rápida: o Rei Orc
  chefe: {
    bpm: 158, bass: 'gallop', arp: false, drums: 'heavy', lead: 'sawtooth', leadVol: 0.05,
    bars: [
      { root: 26, chord: [62, 65, 69], lead: [62, 0, 62, 65, 0, 62, 0, 69, 0, 67, 65, 0, 62, 0, 65, 0] },
      { root: 34, chord: [58, 62, 65], lead: [58, 0, 58, 62, 0, 58, 0, 65, 0, 64, 62, 0, 58, 0, 62, 0] },
      { root: 31, chord: [55, 58, 62], lead: [67, 0, 67, 70, 0, 67, 0, 74, 0, 72, 70, 0, 67, 0, 70, 0] },
      { root: 33, chord: [57, 61, 64], lead: [69, 0, 69, 73, 0, 69, 0, 76, 0, 74, 73, 0, 69, 0, 73, 0] },
    ],
  },
};

export type TrackName = keyof typeof TRACKS;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<string, number>();

  musicOn = true;
  sfxOn = true;

  private track: TrackName = 'calma';
  private wanted: TrackName = 'calma';
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  private switching = false;

  constructor() {
    try {
      this.musicOn = localStorage.getItem('hhk_music') !== '0';
      this.sfxOn = localStorage.getItem('hhk_sfx') !== '0';
    } catch { /* sem armazenamento: segue com o padrão */ }
  }

  /** Cria o áudio (só pode depois de um clique/tecla) e começa a música. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      this.master = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxOn ? 0.9 : 0;
      this.musicGain.gain.value = this.musicOn ? 0.5 : 0;
      this.master.gain.value = 0.8;
      this.sfxGain.connect(this.master);
      this.musicGain.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // ruído branco reaproveitado em todos os efeitos
      const n = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.startMusic();
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend(); else void this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    try { localStorage.setItem('hhk_music', on ? '1' : '0'); } catch { /* ignora */ }
    if (this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.05);
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    try { localStorage.setItem('hhk_sfx', on ? '1' : '0'); } catch { /* ignora */ }
    if (this.ctx) this.sfxGain.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  /* ---------- peças de síntese ---------- */

  private tone(o: ToneOpts) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = o.when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.dur);
    const vol = o.vol ?? 0.15, atk = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(o.dest ?? this.sfxGain);
    osc.start(t);
    osc.stop(t + o.dur + 0.03);
  }

  private noise(o: NoiseOpts) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = o.when ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = o.filter ?? 'bandpass';
    filt.frequency.setValueAtTime(o.f, t);
    if (o.f2) filt.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
    filt.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(filt).connect(g).connect(o.dest ?? this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.03);
  }

  /** evita dezenas do mesmo som ao mesmo tempo */
  private gate(name: string, ms: number) {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const now = performance.now();
    if (now - (this.last.get(name) ?? -1e9) < ms) return false;
    this.last.set(name, now);
    return true;
  }

  private arp(notes: number[], gap: number, type: Wave, vol: number, len = 0.12) {
    const t = this.ctx!.currentTime;
    notes.forEach((m, i) => this.tone({ f: mf(m), dur: len, type, vol, when: t + i * gap }));
  }

  /* ---------- efeitos ---------- */

  hit(big = false) {
    if (!this.gate('hit', 45)) return;
    this.noise({ f: 1100, dur: 0.08, vol: big ? 0.4 : 0.28, q: 1.2 });
    this.tone({ f: 190, f2: 70, dur: 0.09, type: 'square', vol: big ? 0.24 : 0.16 });
    if (big) this.tone({ f: 90, f2: 40, dur: 0.18, type: 'sine', vol: 0.35 });
  }

  swordHit() {
    if (!this.gate('sword', 40)) return;
    this.noise({ f: 2400, dur: 0.1, filter: 'highpass', vol: 0.22 });
    this.noise({ f: 500, f2: 2600, dur: 0.12, vol: 0.2 });
    this.tone({ f: 640, f2: 210, dur: 0.07, type: 'sawtooth', vol: 0.12 });
  }

  thud() {
    if (!this.gate('thud', 90)) return;
    this.noise({ f: 500, filter: 'lowpass', dur: 0.14, vol: 0.3 });
    this.tone({ f: 110, f2: 55, dur: 0.14, type: 'sine', vol: 0.3 });
  }

  coin() {
    if (!this.gate('coin', 70)) return;
    const t = this.ctx!.currentTime;
    this.tone({ f: 988, dur: 0.07, type: 'square', vol: 0.09, when: t });
    this.tone({ f: 1319, dur: 0.14, type: 'square', vol: 0.09, when: t + 0.06 });
  }

  coinSoft() {
    if (!this.gate('coinSoft', 500)) return;
    this.tone({ f: 1319, dur: 0.1, type: 'triangle', vol: 0.05 });
  }

  build() {
    if (!this.gate('build', 100)) return;
    this.tone({ f: 200, f2: 420, dur: 0.14, type: 'triangle', vol: 0.18 });
    const t = this.ctx!.currentTime;
    this.noise({ f: 300, filter: 'lowpass', dur: 0.1, vol: 0.3, when: t });
    this.noise({ f: 300, filter: 'lowpass', dur: 0.1, vol: 0.3, when: t + 0.12 });
    this.tone({ f: mf(72), dur: 0.12, type: 'square', vol: 0.1, when: t + 0.2 });
    this.tone({ f: mf(79), dur: 0.2, type: 'square', vol: 0.1, when: t + 0.28 });
  }

  upgrade(fanfare = false) {
    if (!this.gate('upgrade', 120)) return;
    this.arp(fanfare ? [60, 64, 67, 72, 76, 79, 84] : [72, 76, 79, 84], fanfare ? 0.08 : 0.07, 'triangle', 0.15, fanfare ? 0.25 : 0.14);
    if (fanfare) this.arp([48, 55, 60], 0.12, 'square', 0.07, 0.4);
  }

  crush() {
    if (!this.gate('crush', 150)) return;
    this.noise({ f: 700, f2: 120, filter: 'lowpass', dur: 0.6, vol: 0.5 });
    this.tone({ f: 130, f2: 35, dur: 0.6, type: 'sine', vol: 0.5 });
  }

  orcDie(boss = false) {
    if (!this.gate(boss ? 'bossDie' : 'orcDie', 120)) return;
    if (boss) { this.bossRoar(true); return; }
    this.tone({ f: 320, f2: 70, dur: 0.28, type: 'sawtooth', vol: 0.14 });
    this.noise({ f: 800, f2: 200, dur: 0.2, vol: 0.18 });
  }

  pop() {
    if (!this.gate('pop', 80)) return;
    this.tone({ f: 620, f2: 140, dur: 0.16, type: 'sine', vol: 0.18 });
  }

  grab() { if (this.gate('grab', 60)) this.tone({ f: 500, f2: 760, dur: 0.06, type: 'square', vol: 0.1 }); }

  throw() { if (this.gate('throw', 60)) this.noise({ f: 300, f2: 2400, dur: 0.18, vol: 0.22 }); }

  magic() {
    if (!this.gate('magic', 60)) return;
    this.tone({ f: 380, f2: 980, dur: 0.22, type: 'sine', vol: 0.15 });
    this.tone({ f: 760, f2: 1500, dur: 0.18, type: 'triangle', vol: 0.06 });
  }

  magicHit() {
    if (!this.gate('magicHit', 60)) return;
    this.noise({ f: 1400, f2: 400, dur: 0.16, vol: 0.2 });
    this.tone({ f: 700, f2: 260, dur: 0.14, type: 'sine', vol: 0.16 });
  }

  /** aviso do raio: um tom subindo durante o tempo de espera */
  strikeCharge(sec: number) {
    if (!this.gate('charge', 150)) return;
    this.tone({ f: 180, f2: 760, dur: sec, type: 'sine', vol: 0.12, attack: sec * 0.8 });
  }

  strikeImpact() {
    if (!this.gate('strike', 100)) return;
    this.noise({ f: 1000, f2: 150, filter: 'lowpass', dur: 0.5, vol: 0.55 });
    this.tone({ f: 100, f2: 32, dur: 0.5, type: 'sine', vol: 0.55 });
    this.tone({ f: 900, f2: 200, dur: 0.12, type: 'sawtooth', vol: 0.12 });
  }

  summon() {
    if (!this.gate('summon', 200)) return;
    this.arp([57, 60, 64, 69, 72], 0.05, 'triangle', 0.12, 0.2);
    this.noise({ f: 2000, f2: 6000, dur: 0.3, filter: 'highpass', vol: 0.08 });
  }

  slam() {
    if (!this.gate('slam', 150)) return;
    this.tone({ f: 80, f2: 28, dur: 0.4, type: 'sine', vol: 0.6 });
    this.noise({ f: 300, f2: 80, filter: 'lowpass', dur: 0.35, vol: 0.5 });
  }

  bossRoar(death = false) {
    if (!this.ctx) return;
    const d = death ? 1.1 : 0.9;
    this.tone({ f: death ? 120 : 95, f2: death ? 30 : 50, dur: d, type: 'sawtooth', vol: 0.3, attack: 0.05 });
    this.tone({ f: death ? 125 : 100, f2: death ? 33 : 54, dur: d, type: 'square', vol: 0.15, attack: 0.05 });
    this.noise({ f: 500, f2: 90, filter: 'lowpass', dur: d * 0.8, vol: 0.45 });
  }

  horn() {
    if (!this.gate('horn', 500)) return;
    const t = this.ctx!.currentTime;
    this.tone({ f: mf(55), dur: 0.35, type: 'sawtooth', vol: 0.12, attack: 0.04, when: t });
    this.tone({ f: mf(60), dur: 0.7, type: 'sawtooth', vol: 0.12, attack: 0.04, when: t + 0.32 });
    this.tone({ f: mf(48), dur: 0.7, type: 'square', vol: 0.06, attack: 0.04, when: t + 0.32 });
  }

  error() {
    if (!this.gate('error', 200)) return;
    const t = this.ctx!.currentTime;
    this.tone({ f: 170, dur: 0.1, type: 'square', vol: 0.12, when: t });
    this.tone({ f: 130, dur: 0.16, type: 'square', vol: 0.12, when: t + 0.11 });
  }

  ui() { if (this.gate('ui', 30)) this.tone({ f: 740, f2: 880, dur: 0.05, type: 'square', vol: 0.08 }); }

  gameOver() {
    if (!this.ctx) return;
    this.arp([67, 64, 60, 55, 48], 0.28, 'triangle', 0.2, 0.5);
  }

  /* ---------- música ---------- */

  private startMusic() {
    if (!this.ctx || this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.pump(), 25);
  }

  /** Pede uma faixa; a troca é suave (a música anterior some e a nova entra). */
  set(name: TrackName) {
    this.wanted = name;
    if (!this.ctx || name === this.track || this.switching) return;
    this.switching = true;
    const g = this.musicGain.gain, t = this.ctx.currentTime;
    const target = this.musicOn ? 0.5 : 0;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.35);
    window.setTimeout(() => {
      this.track = this.wanted;
      this.step = 0;
      this.nextTime = this.ctx!.currentTime + 0.05;
      const t2 = this.ctx!.currentTime;
      g.setValueAtTime(0, t2);
      g.linearRampToValueAtTime(target, t2 + 0.5);
      this.switching = false;
    }, 380);
  }

  /** agenda as notas dos próximos instantes (um passo = uma semicolcheia) */
  private pump() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.switching) return;
    const tr = TRACKS[this.track];
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(tr, this.step, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playStep(tr: Track, step: number, t: number, sd: number) {
    const bar = tr.bars[Math.floor(step / 16) % tr.bars.length];
    const s = step % 16;
    const dest = this.musicGain;

    // melodia
    const n = bar.lead[s];
    if (n) this.tone({ f: mf(n), dur: sd * 2 * 0.92, type: tr.lead, vol: tr.leadVol, when: t, dest });

    // baixo
    if (tr.bass === 'long') {
      if (s % 8 === 0) this.tone({ f: mf(bar.root), dur: sd * 8 * 0.9, type: 'triangle', vol: 0.14, when: t, dest });
    } else if (tr.bass === 'drive') {
      if (s % 2 === 0) this.tone({ f: mf(bar.root + (s % 8 === 6 ? 12 : 0)), dur: sd * 1.8, type: 'sawtooth', vol: 0.06, when: t, dest });
    } else if ([0, 1, 3, 4, 6, 8, 9, 11, 12, 14].includes(s)) {
      this.tone({ f: mf(bar.root), dur: sd * 0.85, type: 'sawtooth', vol: 0.075, when: t, dest });
    }

    // arpejo do acorde
    if (tr.arp && s % 2 === 0) {
      this.tone({ f: mf(bar.chord[(s / 2) % bar.chord.length] + 12), dur: sd * 1.5, type: 'square', vol: 0.022, when: t, dest });
    }

    // bateria
    const kick = () => this.tone({ f: 160, f2: 42, dur: 0.13, type: 'sine', vol: 0.45, when: t, dest });
    const snare = () => {
      this.noise({ f: 1800, filter: 'highpass', dur: 0.13, vol: 0.2, when: t, dest });
      this.tone({ f: 190, f2: 120, dur: 0.08, type: 'triangle', vol: 0.12, when: t, dest });
    };
    const hat = (v: number) => this.noise({ f: 8000, filter: 'highpass', dur: 0.04, vol: v, when: t, dest });
    if (tr.drums === 'soft') {
      if (s % 4 === 2) hat(0.05);
      if (s === 0 && step % 32 === 0) this.tone({ f: 120, f2: 60, dur: 0.2, type: 'sine', vol: 0.18, when: t, dest });
    } else if (tr.drums === 'rock') {
      if (s % 4 === 0) kick();
      if (s === 4 || s === 12) snare();
      if (s % 2 === 0) hat(0.07);
    } else {
      if ([0, 3, 8, 10].includes(s)) kick();
      if (s === 4 || s === 12) snare();
      hat(s % 2 === 0 ? 0.07 : 0.04);
    }
  }
}

export const audio = new AudioEngine();
export const sfx = audio;

/** Libera o áudio no primeiro clique ou tecla (exigência dos navegadores). */
export function unlockAudio() {
  const go = () => audio.unlock();
  window.addEventListener('pointerdown', go, { once: false });
  window.addEventListener('keydown', go, { once: false });
  // iPhone: o som só libera dentro de um toque que termina ou de um clique
  window.addEventListener('touchend', go, { once: false });
  window.addEventListener('click', go, { once: false });
}
