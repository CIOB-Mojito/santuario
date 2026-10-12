/**
 * Muestras de audio reales (OpenGameArt, CC0). Se decodifican una sola vez,
 * tras el primer gesto del usuario, y se reproducen en bucle por capas.
 * Si un navegador no puede decodificar, la capa queda en silencio sin romper.
 */

/** Capas con muestra real. Las demas (reverb) se aproximan con otras. */
export type SoundId = 'windExterior' | 'interior' | 'candles';

const base = (): string => {
  const b = (import.meta.env?.BASE_URL as string | undefined) ?? './';
  return b.endsWith('/') ? b : `${b}/`;
};

export const SOUND_URLS: Readonly<Record<SoundId, string>> = {
  windExterior: `${base()}assets/audio/wind_exterior.ogg`,
  interior: `${base()}assets/audio/interior_drone.ogg`,
  candles: `${base()}assets/audio/candles_fire.ogg`
};

/** Decodifica un archivo a un AudioBuffer. Devuelve null si falla. */
export async function loadSound(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    return await ctx.decodeAudioData(data);
  } catch {
    return null;
  }
}
