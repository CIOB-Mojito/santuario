export type QualityLevel = 'QUALITY_LOW' | 'QUALITY_MEDIUM' | 'QUALITY_HIGH';

export interface QualityProfile {
  readonly level: QualityLevel;
  readonly label: string;
  readonly pixelRatioCap: number;
  readonly antialias: boolean;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly drawDistance: number;
  readonly maxPixelRatioToShadows: number;
  readonly textureResSecondary: number;
  readonly particleCount: number;
  readonly lodBias: number;
}

/**
 * Perfiles de la seccion 30 de la especificacion. LOW y MEDIUM son los reales
 * para movil; HIGH existe para equipos con margen.
 */
export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  QUALITY_LOW: {
    level: 'QUALITY_LOW',
    label: 'Baja',
    pixelRatioCap: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    drawDistance: 70,
    maxPixelRatioToShadows: 0,
    textureResSecondary: 512,
    particleCount: 120,
    lodBias: 1.4
  },
  QUALITY_MEDIUM: {
    level: 'QUALITY_MEDIUM',
    label: 'Media',
    pixelRatioCap: 1.5,
    antialias: false,
    shadows: true,
    shadowMapSize: 1024,
    drawDistance: 110,
    maxPixelRatioToShadows: 1.5,
    textureResSecondary: 1024,
    particleCount: 260,
    lodBias: 1
  },
  QUALITY_HIGH: {
    level: 'QUALITY_HIGH',
    label: 'Alta',
    pixelRatioCap: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    drawDistance: 160,
    maxPixelRatioToShadows: 2,
    textureResSecondary: 2048,
    particleCount: 420,
    lodBias: 0.8
  }
};

const ORDER: QualityLevel[] = ['QUALITY_LOW', 'QUALITY_MEDIUM', 'QUALITY_HIGH'];

export function nextQuality(level: QualityLevel): QualityLevel {
  const i = ORDER.indexOf(level);
  return ORDER[(i + 1) % ORDER.length];
}

/**
 * Sondeo conservador (seccion 30). Ante la duda elige bajo y deja que el
 * usuario o el sistema adaptativo suban despues.
 */
export function detectDeviceProfile(): QualityLevel {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 2;
  const dpr = window.devicePixelRatio || 1;
  const mem = nav.deviceMemory;

  let score = 0;
  score += cores >= 8 ? 3 : cores >= 6 ? 2 : cores >= 4 ? 1 : 0;
  score += dpr >= 3 ? 2 : dpr >= 2 ? 1 : 0;
  if (mem !== undefined) score += mem >= 8 ? 2 : mem >= 4 ? 1 : 0;

  if (score <= 1) return 'QUALITY_LOW';
  if (score <= 3) return 'QUALITY_MEDIUM';
  return 'QUALITY_HIGH';
}
