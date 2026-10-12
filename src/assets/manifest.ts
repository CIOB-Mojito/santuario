import type { AssetDescriptor } from './types';

/**
 * Catalogo de recursos reales. URLs relativas a la raiz de `public/`, de modo
 * que funcionan igual en desarrollo y en un despliegue con base relativa.
 *
 * Los dos modelos "Huesped" provienen del commit 8f55b36 del colaborador; se
 * conservan y se reintegran a la arquitectura nueva. El mas pesado queda con
 * prioridad baja y no cabe en el presupuesto movil hasta que interese.
 */
export const ASSETS: readonly AssetDescriptor[] = [
  {
    id: 'character.huesped',
    kind: 'character',
    url: 'assets/characters/Huesped.glb',
    priority: 'high',
    bytes: 975728,
    maxDistance: 60,
    notes: 'Huesped, version ligera (aportado por el colaborador)'
  },
  {
    id: 'character.huesped.v2',
    kind: 'character',
    url: 'assets/characters/Huesped-v2.glb',
    priority: 'low',
    bytes: 5554652,
    maxDistance: 30,
    notes: 'Huesped v2, alta densidad (aportado por el colaborador)'
  }
];

export const MOBILE_BUDGET_BYTES = 3 * 1024 * 1024;
