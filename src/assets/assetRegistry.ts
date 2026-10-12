import type { AssetDescriptor, AssetEntry, AssetKind, AssetStatus } from './types';

/**
 * Catalogo de assets reales (seccion 14 de o.txt). Describe lo que existe en
 * el arbol, con su licencia y estado. `null` significa «pendiente de
 * verificar», nunca un dato inventado.
 */
export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly category: AssetKind | 'sky' | 'hdri';
  readonly file: string | null;
  readonly source: string;
  readonly author: string;
  readonly license: string;
  readonly attributionRequired: boolean | null;
  readonly bytes: number | null;
  readonly triangles: number | null;
  readonly status: 'descargado' | 'integrado' | 'pendiente' | 'bloqueado';
}

export const ASSET_CATALOG: readonly CatalogEntry[] = [
  { id: 'stone_wall_slates', name: 'Muros de pizarra', category: 'architecture', file: 'public/assets/textures/stone_wall_slates/', source: 'Poly Haven', author: 'Poly Haven', license: 'CC0-1.0', attributionRequired: false, bytes: 2164000, triangles: null, status: 'integrado' },
  { id: 'floor_cobblestone', name: 'Suelo de adoquin', category: 'architecture', file: 'public/assets/textures/floor_cobblestone/', source: 'Poly Haven', author: 'Poly Haven', license: 'CC0-1.0', attributionRequired: false, bytes: 1950000, triangles: null, status: 'integrado' },
  { id: 'wood_dark_planks', name: 'Madera oscura', category: 'material', file: 'public/assets/textures/wood_dark_planks/', source: 'Poly Haven', author: 'Poly Haven', license: 'CC0-1.0', attributionRequired: false, bytes: 1986000, triangles: null, status: 'integrado' },
  { id: 'plaster_wall', name: 'Yeso de pared', category: 'material', file: 'public/assets/textures/plaster_wall/', source: 'Poly Haven', author: 'Poly Haven', license: 'CC0-1.0', attributionRequired: false, bytes: 1450000, triangles: null, status: 'integrado' },
  { id: 'marble_012', name: 'Marmol 012', category: 'material', file: 'public/assets/textures/marble_012/', source: 'ambientCG', author: 'Lennart Demes (ambientCG)', license: 'CC0-1.0', attributionRequired: false, bytes: 4563000, triangles: null, status: 'integrado' },
  { id: 'metal_gold_base', name: 'Metal (base de oro)', category: 'material', file: 'public/assets/textures/metal_gold_base/', source: 'ambientCG', author: 'Lennart Demes (ambientCG)', license: 'CC0-1.0', attributionRequired: false, bytes: 2534000, triangles: null, status: 'integrado' },
  { id: 'sky_citrus', name: 'HDRI cielo estival', category: 'hdri', file: 'public/assets/sky/sky_citrus/', source: 'Poly Haven', author: 'Poly Haven', license: 'CC0-1.0', attributionRequired: false, bytes: 1248000, triangles: null, status: 'integrado' },
  { id: 'character.huesped', name: 'Huesped (GLB)', category: 'character', file: 'public/assets/characters/Huesped.glb', source: 'commit 8f55b36 (colaborador)', author: 'desconocido', license: 'por verificar', attributionRequired: null, bytes: 975728, triangles: null, status: 'integrado' },
  { id: 'statue.marble', name: 'Estatua de marmol (Sun Goddess)', category: 'statue', file: 'public/assets/statues/marble_statue.glb', source: 'OpenGameArt', author: 'Daniel Andersson (hreikin)', license: 'CC0-1.0', attributionRequired: false, bytes: 581472, triangles: 16987, status: 'integrado' },
  { id: 'statue.effigy', name: 'Caballero yacente', category: 'statue', file: 'public/assets/statues/knight_effigy.glb', source: 'OpenGameArt', author: 'yd', license: 'CC0-1.0', attributionRequired: false, bytes: 477368, triangles: 6238, status: 'integrado' },
  { id: 'props.candles', name: 'Candelabro medieval', category: 'prop', file: 'public/assets/props/candles.glb', source: 'OpenGameArt', author: 'AnyRPG', license: 'CC0-1.0', attributionRequired: false, bytes: 10648, triangles: 254, status: 'integrado' },
  { id: 'props.mausoleum', name: 'Mausoleo', category: 'architecture', file: 'public/assets/props/mausoleum.glb', source: 'OpenGameArt', author: 'Paul Wortmann', license: 'CC0-1.0', attributionRequired: false, bytes: 132952, triangles: 1832, status: 'integrado' },
  { id: 'props.tomb', name: 'Sepulcro', category: 'prop', file: 'public/assets/props/tomb.glb', source: 'OpenGameArt', author: 'zerberros', license: 'CC0-1.0', attributionRequired: false, bytes: 9520, triangles: 150, status: 'integrado' },
  { id: 'props.grave.1', name: 'Lapida 1', category: 'prop', file: 'public/assets/props/grave_1.glb', source: 'OpenGameArt', author: 'Savino', license: 'CC0-1.0', attributionRequired: false, bytes: 2320, triangles: 140, status: 'integrado' },
  { id: 'props.grave.2', name: 'Lapida 2', category: 'prop', file: 'public/assets/props/grave_2.glb', source: 'OpenGameArt', author: 'Savino', license: 'CC0-1.0', attributionRequired: false, bytes: 2208, triangles: 140, status: 'integrado' },
  { id: 'props.grave.3', name: 'Lapida 3', category: 'prop', file: 'public/assets/props/grave_3.glb', source: 'OpenGameArt', author: 'Savino', license: 'CC0-1.0', attributionRequired: false, bytes: 1780, triangles: 140, status: 'integrado' },
  { id: 'props.grave.4', name: 'Lapida 4', category: 'prop', file: 'public/assets/props/grave_4.glb', source: 'OpenGameArt', author: 'Savino', license: 'CC0-1.0', attributionRequired: false, bytes: 3812, triangles: 140, status: 'integrado' },
  { id: 'props.grave.5', name: 'Lapida 5', category: 'prop', file: 'public/assets/props/grave_5.glb', source: 'OpenGameArt', author: 'Savino', license: 'CC0-1.0', attributionRequired: false, bytes: 2440, triangles: 140, status: 'integrado' },
  { id: 'props.grave.6', name: 'Lapida 6', category: 'prop', file: 'public/assets/props/grave_6.glb', source: 'OpenGameArt', author: 'Savino', license: 'CC0-1.0', attributionRequired: false, bytes: 3232, triangles: 140, status: 'integrado' },
  { id: 'sculpture.angel', name: 'Angel funerario (calidad final)', category: 'statue', file: null, source: 'pendiente (Sketchfab/Smithsonian/OpenGameArt)', author: 'pendiente', license: 'pendiente de verificar', attributionRequired: false, bytes: null, triangles: null, status: 'pendiente' }
];

/**
 * Registro central de recursos. En esta fase NO carga modelos (la carga llega
 * con el streaming, seccion 26): solo mantiene el catalogo, su estado y el
 * presupuesto de memoria. Es funcional y honesto: no finge tener assets.
 */
export class AssetRegistry {
  private readonly entries = new Map<string, AssetEntry>();

  register(descriptor: AssetDescriptor): AssetEntry {
    if (this.entries.has(descriptor.id)) {
      throw new Error(`Asset duplicado: ${descriptor.id}`);
    }
    const entry: AssetEntry = { ...descriptor, status: 'placeholder', object: null };
    this.entries.set(descriptor.id, entry);
    return entry;
  }

  registerMany(descriptors: readonly AssetDescriptor[]): void {
    for (const d of descriptors) this.register(d);
  }

  get(id: string): AssetEntry | undefined {
    return this.entries.get(id);
  }

  get size(): number {
    return this.entries.size;
  }

  countByKind(kind: AssetKind): number {
    let n = 0;
    for (const e of this.entries.values()) if (e.kind === kind) n++;
    return n;
  }

  /** Presupuesto de la seccion 26: suma de bytes de todo lo que no es placeholder. */
  residentBytes(): number {
    let total = 0;
    for (const e of this.entries.values()) {
      if (e.status === 'ready') total += e.bytes;
    }
    return total;
  }

  setStatus(id: string, status: AssetStatus, object: unknown = null): void {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Asset inexistente: ${id}`);
    entry.status = status;
    entry.object = object;
  }

  listByPriority(): AssetEntry[] {
    const weight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...this.entries.values()].sort((a, b) => weight[a.priority] - weight[b.priority]);
  }
}
