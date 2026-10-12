import type { AssetDescriptor, AssetEntry, AssetKind, AssetStatus } from './types';

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
