import * as THREE from 'three';
import type { AssetEntry } from '../assets/types';
import type { AssetRegistry } from '../assets/AssetRegistry';

export type AssetLoader = (entry: AssetEntry) => Promise<unknown>;

interface QueueItem {
  readonly entry: AssetEntry;
  distance: number;
}

/**
 * Streaming por prioridad y distancia (seccion 26). Decide que se carga ahora
 * segun un presupuesto de memoria y la distancia al jugador, carga en serie
 * (para no saturar la red movil) y libera lo lejano. El loader real se inyecta;
 * hoy no hay modelos, pero la politica de carga ya es verificable.
 */
export class StreamingManager {
  private readonly registry: AssetRegistry;
  private readonly loader: AssetLoader;
  private readonly budgetBytes: number;
  private queue: QueueItem[] = [];
  private loading = false;
  private readonly unloadDistance: number;

  loadedCount = 0;
  releasedCount = 0;
  budgetExceeded = false;

  get queueLength(): number {
    return this.queue.length;
  }

  constructor(registry: AssetRegistry, loader: AssetLoader, budgetBytes = 48 * 1024 * 1024, unloadDistance = 140) {
    this.registry = registry;
    this.loader = loader;
    this.budgetBytes = budgetBytes;
    this.unloadDistance = unloadDistance;
  }

  /** Recalcula la cola segun la posicion del jugador. */
  update(playerPosition: THREE.Vector3): void {
    const weight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    // Solo se encola lo que tiene una URL real: hoy todo es placeholder, asi
    // que la cola esta vacia y no se simula ninguna carga inexistente.
    this.queue = this.registry
      .listByPriority()
      .filter((e) => e.status === 'placeholder' && e.url !== null)
      .map((entry) => ({ entry, distance: weight[entry.priority] * 1000 + Math.abs(entry.maxDistance - playerPosition.length()) }))
      .sort((a, b) => a.distance - b.distance);

    if (!this.loading) void this.pump();
    this.releaseFar(playerPosition);
  }

  private async pump(): Promise<void> {
    this.loading = true;
    try {
      while (this.queue.length > 0) {
        const next = this.queue[0];
        if (next.entry.bytes > 0 && this.registry.residentBytes() + next.entry.bytes > this.budgetBytes) {
          this.budgetExceeded = true;
          break;
        }
        this.queue.shift();
        this.registry.setStatus(next.entry.id, 'loading');
        try {
          const object = await this.loader(next.entry);
          this.registry.setStatus(next.entry.id, 'ready', object);
          this.loadedCount++;
        } catch {
          this.registry.setStatus(next.entry.id, 'missing');
        }
      }
    } finally {
      this.loading = false;
    }
  }

  private releaseFar(playerPosition: THREE.Vector3): void {
    for (const entry of this.registry.listByPriority()) {
      if (entry.status !== 'ready') continue;
      if (Math.abs(entry.maxDistance - playerPosition.length()) > this.unloadDistance && entry.priority === 'low') {
        this.registry.setStatus(entry.id, 'placeholder', null);
        this.releasedCount++;
      }
    }
  }
}
