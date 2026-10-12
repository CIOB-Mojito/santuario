export type QualityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

export interface QualityProfile {
  readonly level: QualityLevel;
  readonly pixelRatioCap: number;
  readonly antialias: boolean;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly maxLights: number;
}

/**
 * Perfiles de calidad. Mobile-first: LOW y MEDIUM son los destinatarios reales,
 * HIGH/ULTRA existen pero no se eligen automaticamente.
 */
export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  LOW: {
    level: 'LOW',
    pixelRatioCap: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    fogNear: 12,
    fogFar: 65,
    maxLights: 3
  },
  MEDIUM: {
    level: 'MEDIUM',
    pixelRatioCap: 1.5,
    antialias: false,
    shadows: true,
    shadowMapSize: 1024,
    fogNear: 16,
    fogFar: 90,
    maxLights: 5
  },
  HIGH: {
    level: 'HIGH',
    pixelRatioCap: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    fogNear: 20,
    fogFar: 125,
    maxLights: 8
  },
  ULTRA: {
    level: 'ULTRA',
    pixelRatioCap: 2.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 4096,
    fogNear: 24,
    fogFar: 160,
    maxLights: 12
  }
};

const ORDER: QualityLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];

export function nextQuality(level: QualityLevel): QualityLevel {
  const i = ORDER.indexOf(level);
  return ORDER[(i + 1) % ORDER.length];
}

/**
 * Sondeo conservador del dispositivo. No busca adivinar de mas: ante la duda,
 * elige un perfil bajo y deja que el sistema adaptativo suba o baje despues.
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

  if (score <= 1) return 'LOW';
  if (score <= 3) return 'MEDIUM';
  return 'HIGH';
}
