/**
 * Ponte com os SDKs dos portais: CrazyGames (v3) e Poki. O mesmo código serve aos dois: cada pacote carrega só o script
 * do seu portal (veja vite.config.ts) e aqui o jogo usa o que estiver na página. Tudo é opcional: sem SDK
 * (desenvolvimento, outro site, sem internet), o jogo funciona igual, só sem anúncios.
 *
 * Regras da Poki que isto cumpre:
 * - gameLoadingFinished ao terminar de carregar; gameplayStart só depois do primeiro toque ou tecla do jogador;
 * - gameplayStop antes de cada anúncio; nada de chamar o SDK durante o anúncio;
 * - som e teclado desligados durante o anúncio; recompensa só se o vídeo foi exibido;
 * - sem temporizador próprio de anúncio (a Poki decide a frequência).
 *
 * Regras do CrazyGames que isto cumpre:
 * - avisa quando o jogador começa e para de jogar (gameplayStart / gameplayStop);
 * - avisa o carregamento (loadingStart / loadingStop);
 * - anúncios: silencia e pausa o jogo durante eles; recompensa só se o anúncio terminar;
 * - o salvamento usa o armazenamento do SDK.
 */
interface CgSdk {
  init(): Promise<void>;
  environment?: string;
  game: { settings?: { muteAudio?: boolean }; addSettingsChangeListener?(fn: (s: { muteAudio?: boolean }) => void): void; gameplayStart(): void; gameplayStop(): void; loadingStart(): void; loadingStop(): void; happytime?(): void };
  ad: { requestAd(type: 'midgame' | 'rewarded', cb: { adStarted?: () => void; adFinished?: () => void; adError?: (e: unknown) => void }): void };
  data?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
  user?: { systemInfo?: { locale?: string } };
}

interface PokiApi {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(onStart?: () => void): Promise<void>;
  rewardedBreak(onStart?: () => void): Promise<boolean>;
  getLanguage?(): string;
}

const raw = (): CgSdk | undefined => (window as unknown as { CrazyGames?: { SDK?: CgSdk } }).CrazyGames?.SDK;
const poki = (): PokiApi | undefined => (window as unknown as { PokiSDK?: PokiApi }).PokiSDK;

export type Platform = 'crazygames' | 'poki' | 'none';

type Listener = (paused: boolean) => void;

class Sdk {
  /** um SDK iniciou e estamos no portal dele (ou no modo de teste dele) */
  active = false;
  platform: Platform = 'none';
  /** Poki: o gameplayStart só pode sair depois da primeira ação do jogador */
  private pokiInput = false;
  private pokiPlaying = false;
  private playing = false;
  private inAd = false;
  /** o anúncio com recompensa falhou sem nem começar (ex.: Basic Launch, sem anúncios): esconde os botões */
  private noAds = false;
  private listeners: Listener[] = [];
  private muteListeners: Listener[] = [];
  /** o CrazyGames pediu para silenciar o jogo (botão de som do site) */
  muted = false;

  /** Chamado quando o jogo precisa pausar e silenciar (anúncio) ou voltar. */
  onPause(fn: Listener) { this.listeners.push(fn); }

  /** Avisa quando o jogador liga ou desliga o som pelo botão do CrazyGames. */
  onMute(fn: Listener) { this.muteListeners.push(fn); }

  async init() {
    if (poki()) { await this.initPoki(); return; }
    const s = raw();
    if (!s) return;
    try {
      // não deixa o jogo esperando para sempre se o SDK demorar
      await Promise.race([s.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
      this.active = s.environment === 'crazygames' || s.environment === 'local';
      if (this.active) {
        this.platform = 'crazygames';
        this.muted = !!s.game.settings?.muteAudio;
        s.game.addSettingsChangeListener?.(cfg => {
          this.muted = !!cfg.muteAudio;
          for (const l of this.muteListeners) l(this.muted);
        });
      }
    } catch {
      this.active = false;
    }
  }

  private async initPoki() {
    const p = poki()!;
    try {
      await Promise.race([p.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    } catch { /* a Poki manda carregar o jogo mesmo se o init falhar */ }
    this.active = true;
    this.platform = 'poki';
    document.body.classList.add('poki');
    // a primeira ação do jogador libera o gameplayStart
    const first = () => { this.pokiInput = true; this.syncPoki(); };
    for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, first, { once: true, capture: true });
    // durante o anúncio o teclado não chega ao jogo
    window.addEventListener('keydown', e => { if (this.inAd) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    // a página não pode rolar junto com o jogo
    window.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp', ' '].includes(e.key)) e.preventDefault(); });
    window.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  }

  /** Avisa a Poki só quando o estado muda (dois gameplayStart seguidos não são permitidos). */
  private syncPoki() {
    if (!this.pokiInput || this.inAd || this.playing === this.pokiPlaying) return;
    this.pokiPlaying = this.playing;
    try { this.playing ? poki()?.gameplayStart() : poki()?.gameplayStop(); } catch { /* ignora */ }
  }

  get locale() {
    if (this.platform === 'poki') { try { return poki()?.getLanguage?.() ?? navigator.language; } catch { return navigator.language; } }
    return raw()?.user?.systemInfo?.locale ?? navigator.language;
  }

  /** anúncios existem: nos portais, ou no modo de desenvolvimento (simulados) */
  get adsAvailable() { return (this.active || import.meta.env.DEV) && !this.noAds; }

  /** armazenamento do SDK do CrazyGames (acompanha o jogador); na Poki e fora dos portais, o do navegador */
  get cloud() { return this.platform === 'crazygames' ? raw()?.data : undefined; }

  // fora dos portais o SDK não inicia: não chama nada dele (senão o console enche de erros)
  loadingStart() { if (this.platform !== 'crazygames') return; try { raw()?.game.loadingStart(); } catch { /* ignora */ } }
  loadingStop() {
    try {
      if (this.platform === 'crazygames') raw()?.game.loadingStop();
      else if (this.platform === 'poki') poki()?.gameLoadingFinished();
    } catch { /* ignora */ }
  }

  /** O jogador está jogando (true) ou está em menu/tela de derrota/pausa (false). Só avisa quando muda. */
  setPlaying(on: boolean) {
    if (on === this.playing) return;
    this.playing = on;
    if (this.platform === 'poki') { this.syncPoki(); return; }
    if (this.platform !== 'crazygames') return;
    try { on ? raw()?.game.gameplayStart() : raw()?.game.gameplayStop(); } catch { /* ignora */ }
  }

  get isPlaying() { return this.playing; }

  happytime() { if (this.platform !== 'crazygames') return; try { raw()?.game.happytime?.(); } catch { /* ignora */ } }

  private pause(on: boolean) {
    this.inAd = on;
    for (const l of this.listeners) l(on);
  }

  /** Anúncio entre uma parte e outra do jogo (o SDK ignora se for cedo demais). */
  midgame(done: () => void) {
    this.request('midgame', () => {}, done);
  }

  /**
   * Na Poki, o anúncio também sai ao voltar de uma pausa para o jogo; nos outros lugares só continua direto
   * (lá os anúncios ficam na derrota, e o CrazyGames tem limites próprios).
   */
  breakBeforeResume(done: () => void) {
    if (this.platform === 'poki') this.midgame(done); else done();
  }

  /** Anúncio com recompensa: `reward` só roda se o anúncio terminar de verdade. */
  rewarded(reward: () => void, failed: () => void) {
    // `failed` só depois de um anúncio sem recompensa: o fim do pedido também passa por aqui quando deu certo
    let got = false;
    this.request('rewarded', () => { got = true; reward(); }, () => { if (!got) failed(); });
  }

  private requestPoki(type: 'midgame' | 'rewarded', ok: () => void, end: () => void) {
    if (this.inAd) { end(); return; }
    const p = poki()!;
    const wasPlaying = this.playing;
    // ordem pedida: gameplayStop -> anúncio -> gameplayStart
    this.setPlaying(false);
    this.pause(true);
    const finish = (success: boolean) => {
      this.pause(false);
      if (wasPlaying) this.setPlaying(true);
      if (success) ok();
      end();
    };
    try {
      if (type === 'rewarded') p.rewardedBreak().then(r => finish(!!r), () => finish(false));
      else p.commercialBreak().then(() => finish(true), () => finish(true));
    } catch {
      finish(false);
    }
  }

  private request(type: 'midgame' | 'rewarded', ok: () => void, end: () => void) {
    if (this.platform === 'poki') { this.requestPoki(type, ok, end); return; }
    const s = raw();
    if (!this.active || !s) {
      // desenvolvimento: finge um anúncio de 1 segundo, para testar a tela
      if (import.meta.env.DEV && type === 'rewarded') {
        this.pause(true);
        setTimeout(() => { this.pause(false); ok(); end(); }, 1000);
      } else if (type === 'rewarded') end();
      else end();
      return;
    }
    if (this.inAd) return;
    let finished = false;
    let started = false;
    const wasPlaying = this.playing;
    const done = (success: boolean) => {
      if (finished) return;
      finished = true;
      this.pause(false);
      if (wasPlaying) this.setPlaying(true);
      if (!success && !started && type === 'rewarded') this.noAds = true;
      if (success) ok();
      end();
    };
    try {
      s.ad.requestAd(type, {
        adStarted: () => { started = true; this.setPlaying(false); this.pause(true); },
        adFinished: () => done(true),
        adError: () => done(false),
      });
    } catch {
      done(false);
    }
  }
}

export const sdk = new Sdk();
