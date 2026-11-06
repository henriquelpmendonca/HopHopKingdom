import { defineConfig } from 'vite';

const CG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>';
const POKI = '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>';

export default defineConfig(({ mode }) => ({
  base: './',
  // host: true deixa outros aparelhos da mesma rede (celular, tablet) abrirem o jogo pelo IP do computador
  server: { host: true, port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 2000, outDir: mode === 'poki' ? 'dist-poki' : 'dist' },
  plugins: [{
    // cada portal bloqueia ou estranha script de outro: o pacote da Poki carrega só o SDK da Poki
    name: 'sdk-do-portal',
    transformIndexHtml(html) {
      if (mode !== 'poki') return html;
      if (!html.includes(CG)) throw new Error('script do CrazyGames não encontrado no index.html');
      return html.replace(CG, POKI);
    },
  }],
}));
