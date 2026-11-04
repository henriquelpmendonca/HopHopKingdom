/**
 * Ponte com o SDK do CrazyGames (v3). Tudo é opcional: se o SDK não estiver na página (desenvolvimento,
 * outro site, sem internet), o jogo funciona igual, só sem anúncios.
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

const raw = (): CgSdk | undefined => (window as unknown as { CrazyGames?: { SDK?: CgSdk } }).CrazyGames?.SDK;

type Listener = (paused: boolean) => void;

class Sdk {
  /** o SDK iniciou e estamos no CrazyGames (ou no modo de teste dele) */
  active = false;
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
    const s = raw();
    if (!s) return;
    try {
      // não deixa o jogo esperando para sempre se o SDK demorar
      await Promise.race([s.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
      this.active = s.environment === 'crazygames' || s.environment === 'local';
      if (this.active) {
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

  get locale() { return raw()?.user?.systemInfo?.locale ?? navigator.language; }

  /** anúncios existem: no CrazyGames, ou no modo de desenvolvimento (simulados) */
  get adsAvailable() { return (this.active || import.meta.env.DEV) && !this.noAds; }

  /** armazenamento do SDK (acompanha o jogador); fora do CrazyGames, o do navegador */
  get cloud() { return this.active ? raw()?.data : undefined; }

  loadingStart() { try { raw()?.game.loadingStart(); } catch { /* ignora */ } }
  loadingStop() { try { raw()?.game.loadingStop(); } catch { /* ignora */ } }

  /** O jogador está jogando (true) ou está em menu/tela de derrota/pausa (false). Só avisa quando muda. */
  setPlaying(on: boolean) {
    if (on === this.playing) return;
    this.playing = on;
    try { on ? raw()?.game.gameplayStart() : raw()?.game.gameplayStop(); } catch { /* ignora */ }
  }

  get isPlaying() { return this.playing; }

  happytime() { try { raw()?.game.happytime?.(); } catch { /* ignora */ } }

  private pause(on: boolean) {
    this.inAd = on;
    for (const l of this.listeners) l(on);
  }

  /** Anúncio entre uma parte e outra do jogo (o SDK ignora se for cedo demais). */
  midgame(done: () => void) {
    this.request('midgame', () => {}, done);
  }

  /** Anúncio com recompensa: `reward` só roda se o anúncio terminar de verdade. */
  rewarded(reward: () => void, failed: () => void) {
    this.request('rewarded', reward, failed);
  }

  private request(type: 'midgame' | 'rewarded', ok: () => void, end: () => void) {
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
