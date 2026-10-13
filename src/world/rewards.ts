/**
 * Recompensas que revela la Caja Premium al abrirse. Se cargan de forma
 * diferida (solo cuando la caja se abre) y de una en una, con cache acotada,
 * de modo que no compiten con el streaming del mundo.
 *
 * Ambos son los vehiculos del visor de origen: `carro.glb` (el carro normal) y
 * `carro_pro.glb`. No se añaden modelos nuevos aqui.
 */
export interface Reward {
  readonly id: string;
  readonly url: string;
  readonly label: string;
}

export const REWARDS: readonly Reward[] = [
  { id: 'reward.carro_pro', url: 'assets/rewards/carro_pro.glb', label: 'Coche Pro' },
  { id: 'reward.carro', url: 'assets/rewards/carro.glb', label: 'Coche' }
];
