import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // host: true deixa outros aparelhos da mesma rede (celular, tablet) abrirem o jogo pelo IP do computador
  server: { host: true, port: 5173, strictPort: true },
  build: { chunkSizeWarningLimit: 2000 },
});
