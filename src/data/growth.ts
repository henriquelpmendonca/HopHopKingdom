/**
 * Crescimento por onda: composto até o "joelho" (onda 30) e bem mais suave depois dele.
 * Sem isso, 8% de vida por onda sem parar dá uns 2.200 vezes a vida da onda 1 na onda 100, e nada que o jogador
 * tenha (níveis de cabana até 35, ~4x mais forte) acompanha. Até a onda 30 o jogo é exatamente como antes.
 */
export const GROWTH_KNEE = 30;

export function waveGrowth(wave: number, early: number, late: number) {
  return Math.pow(1 + early, Math.min(wave, GROWTH_KNEE)) * Math.pow(1 + late, Math.max(0, wave - GROWTH_KNEE));
}
