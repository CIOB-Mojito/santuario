import type { ZoneDef } from '../world/zones';

export interface Fragment {
  readonly zoneId: string;
  readonly text: string;
}

/**
 * Narrativa ambiental (seccion 32). El texto NO debe ir incrustado en el codigo
 * de la escena: vive en datos externos que aqui se leen y se sirven por zona,
 * sin repetir un fragmento ya presentado.
 */
export class NarrativeSystem {
  private fragments: Fragment[] = [];
  private readonly seen = new Set<string>();
  private readonly visitCounts = new Map<string, number>();

  load(fragments: readonly Fragment[]): void {
    this.fragments = [...fragments];
  }

  get size(): number {
    return this.fragments.length;
  }

  visitCount(zoneId: string): number {
    return this.visitCounts.get(zoneId) ?? 0;
  }

  /** Devuelve el siguiente fragmento no visto de la zona, o null. */
  next(zone: ZoneDef): Fragment | null {
    this.visitCounts.set(zone.id, this.visitCount(zone.id) + 1);
    for (const fragment of this.fragments) {
      if (fragment.zoneId !== zone.id) continue;
      if (this.seen.has(fragment.text)) continue;
      this.seen.add(fragment.text);
      return fragment;
    }
    return null;
  }
}
