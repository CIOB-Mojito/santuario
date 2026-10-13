import type { AssetDescriptor } from './types';

/**
 * Catalogo de recursos reales. URLs relativas a la raiz de `public/`, de modo
 * que funcionan igual en desarrollo y en un despliegue con base relativa.
 *
 * Modelos:
 * - Huesped/Huesped-v2 del commit 8f55b36 del colaborador (licencia por
 *   verificar); ambos son prioritarios porque forman la fila de personajes.
 * - Estatuas y props descargados de OpenGameArt (CC0), convertidos a GLB con
 *   libassimp y optimizados con gltf-transform (ver docs/asset-sources.md).
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
    priority: 'high',
    bytes: 5554652,
    maxDistance: 24,
    notes: 'Huesped v2, alta densidad (aportado por el colaborador)'
  },
  {
    id: 'statue.angel_vcu',
    kind: 'statue',
    url: 'assets/statues/angel_vcu.glb',
    priority: 'high',
    bytes: 1190112,
    maxDistance: 100,
    notes: 'Angel de sepultura (escaneo; aportado por el usuario, licencia por verificar)'
  },
  {
    id: 'statue.angel_frances',
    kind: 'statue',
    url: 'assets/statues/angel_frances.glb',
    priority: 'high',
    bytes: 2384788,
    maxDistance: 110,
    notes: 'Angel de cementerio "Frances" (escaneo; aportado por el usuario, licencia por verificar)'
  },
  {
    id: 'statue.wooden_angel',
    kind: 'statue',
    url: 'assets/statues/wooden_angel.glb',
    priority: 'medium',
    bytes: 1762780,
    maxDistance: 90,
    notes: 'Escultura de angel en madera (aportado por el usuario, licencia por verificar)'
  },
  {
    id: 'statue.monument_angel',
    kind: 'statue',
    url: 'assets/statues/monument_angel.glb',
    priority: 'low',
    bytes: 3973224,
    maxDistance: 200,
    notes: 'Monumento con angel (escaneo grande; aportado por el usuario, licencia por verificar)'
  },
  {
    id: 'props.fountain_putti',
    kind: 'prop',
    url: 'assets/props/fountain_putti.glb',
    priority: 'medium',
    bytes: 3133252,
    maxDistance: 160,
    notes: 'Fuente con tres putti, Brno Luzanky (aportado por el usuario, licencia por verificar)'
  },
  {
    id: 'statue.marble',
    kind: 'statue',
    url: 'assets/statues/marble_statue.glb',
    priority: 'high',
    bytes: 581472,
    maxDistance: 90,
    notes: 'Estatua de marmol (Sun Goddess, OpenGameArt, CC0)'
  },
  {
    id: 'statue.effigy',
    kind: 'statue',
    url: 'assets/statues/knight_effigy.glb',
    priority: 'high',
    bytes: 477368,
    maxDistance: 90,
    notes: 'Figura yacente de caballero (OpenGameArt, CC0)'
  },
  {
    id: 'props.candles',
    kind: 'prop',
    url: 'assets/props/candles.glb',
    priority: 'medium',
    bytes: 10648,
    maxDistance: 60,
    notes: 'Candelabro medieval (OpenGameArt, CC0)'
  },
  {
    id: 'props.mausoleum',
    kind: 'architecture',
    url: 'assets/props/mausoleum.glb',
    priority: 'medium',
    bytes: 132952,
    maxDistance: 140,
    notes: 'Mausoleo (OpenGameArt, CC0)'
  },
  {
    id: 'props.tomb',
    kind: 'prop',
    url: 'assets/props/tomb.glb',
    priority: 'low',
    bytes: 9520,
    maxDistance: 90,
    notes: 'Sepulcro (OpenGameArt, CC0)'
  },
  {
    id: 'props.grave.1',
    kind: 'prop',
    url: 'assets/props/grave_1.glb',
    priority: 'low',
    bytes: 2320,
    maxDistance: 80,
    notes: 'Lapida (OpenGameArt, CC0)'
  },
  {
    id: 'props.grave.2',
    kind: 'prop',
    url: 'assets/props/grave_2.glb',
    priority: 'low',
    bytes: 2208,
    maxDistance: 80,
    notes: 'Lapida (OpenGameArt, CC0)'
  },
  {
    id: 'props.grave.3',
    kind: 'prop',
    url: 'assets/props/grave_3.glb',
    priority: 'low',
    bytes: 1780,
    maxDistance: 80,
    notes: 'Lapida (OpenGameArt, CC0)'
  },
  {
    id: 'props.grave.4',
    kind: 'prop',
    url: 'assets/props/grave_4.glb',
    priority: 'low',
    bytes: 3812,
    maxDistance: 80,
    notes: 'Lapida (OpenGameArt, CC0)'
  },
  {
    id: 'props.grave.5',
    kind: 'prop',
    url: 'assets/props/grave_5.glb',
    priority: 'low',
    bytes: 2440,
    maxDistance: 80,
    notes: 'Lapida (OpenGameArt, CC0)'
  },
  {
    id: 'props.grave.6',
    kind: 'prop',
    url: 'assets/props/grave_6.glb',
    priority: 'low',
    bytes: 3232,
    maxDistance: 80,
    notes: 'Lapida (OpenGameArt, CC0)'
  }
];

// Presupuesto de residencia del streaming. Con el catalogo real (dos Huesped,
// estatuas y props) 6 MB dejaba fuera a media escena: un Huesped y su v2 ya
// suman 6.5 MB. 24 MB cubre el arbol completo sin descargar casi todo.
export const MOBILE_BUDGET_BYTES = 24 * 1024 * 1024;
