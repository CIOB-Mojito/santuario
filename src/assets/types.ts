/**
 * Tipos del sistema de assets (secciones 13 y 14). Todo recurso se describe
 * por metadatos antes de existir en memoria: eso permite sustituir un
 * placeholder por un modelo real sin tocar el mundo.
 */
export type AssetKind = 'architecture' | 'statue' | 'altar' | 'prop' | 'material' | 'texture' | 'character' | 'animation' | 'audio' | 'particle' | 'environment';

export type AssetPriority = 'critical' | 'high' | 'medium' | 'low';

export type AssetStatus = 'placeholder' | 'loading' | 'ready' | 'missing';

export interface AssetDescriptor {
  readonly id: string;
  readonly kind: AssetKind;
  readonly url: string | null;
  readonly priority: AssetPriority;
  readonly bytes: number;
  readonly maxDistance: number;
  readonly notes?: string;
}

export interface AssetEntry extends AssetDescriptor {
  status: AssetStatus;
  object: unknown;
}

export function isDescriptor(value: AssetEntry): value is AssetEntry {
  return typeof value.id === 'string' && typeof value.kind === 'string';
}
