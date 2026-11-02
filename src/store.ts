import { sdk } from './sdk';

/**
 * Armazenamento de texto: no CrazyGames usa o do SDK (o progresso acompanha o jogador),
 * em qualquer outro lugar usa o localStorage do navegador. Nunca dá erro.
 */
export const store = {
  get(key: string): string | null {
    try {
      const c = sdk.cloud;
      if (c) return c.getItem(key);
    } catch { /* cai no navegador */ }
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try {
      const c = sdk.cloud;
      if (c) { c.setItem(key, value); return; }
    } catch { /* cai no navegador */ }
    try { localStorage.setItem(key, value); } catch { /* sem espaço: segue sem salvar */ }
  },
  remove(key: string) {
    try {
      const c = sdk.cloud;
      if (c) { c.removeItem(key); return; }
    } catch { /* cai no navegador */ }
    try { localStorage.removeItem(key); } catch { /* ignora */ }
  },
};
