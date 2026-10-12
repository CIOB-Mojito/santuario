import * as THREE from 'three';

/**
 * Zonas semanticas (seccion 21). El mundo no es una geometria plana: es un
 * recorrido con significado. Estas zonas gobiernan audio, niebla y narrativa.
 */
export interface ZoneDef {
  readonly id: string;
  readonly name: string;
  readonly center: [number, number, number];
  readonly radius: number;
  readonly interior: boolean;
  readonly fogDensity: number;
  readonly ambientLevel: number;
}

export const ZONES: readonly ZoneDef[] = [
  {
    id: 'exterior',
    name: 'Antesala del Sol',
    center: [0, 0, 54],
    radius: 55,
    interior: false,
    fogDensity: 0.0016,
    ambientLevel: 1
  },
  {
    id: 'nave',
    name: 'Nave de la Primera Memoria',
    center: [0, 0, 0],
    radius: 40,
    interior: true,
    fogDensity: 0.03,
    ambientLevel: 0.32
  }
];

let cachedCenters: { def: ZoneDef; center: THREE.Vector3 }[] | null = null;

function zoneCenters(): { def: ZoneDef; center: THREE.Vector3 }[] {
  if (!cachedCenters) {
    cachedCenters = ZONES.map((def) => ({
      def,
      center: new THREE.Vector3(def.center[0], def.center[1], def.center[2])
    }));
  }
  return cachedCenters;
}

export function zoneAt(position: THREE.Vector3): ZoneDef {
  let best = ZONES[0];
  let bestMetric = Infinity;
  for (const { def, center } of zoneCenters()) {
    const metric = position.distanceTo(center) - def.radius;
    if (metric < bestMetric) {
      bestMetric = metric;
      best = def;
    }
  }
  return best;
}
