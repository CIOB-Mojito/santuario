/**
 * Constantes de arranque. Nada de magia repartida por el codigo: los numeros
 * que definen camara, jugador y mundo viven aqui.
 */
export const SETTINGS = {
  render: {
    fov: 62,
    near: 0.1,
    far: 500
  },
  player: {
    eyeHeight: 1.65,
    radius: 0.35,
    walkSpeed: 3.1,
    runSpeed: 5.2,
    smoothing: 12,
    lookSpeed: 0.0024,
    headBobAmplitude: 0.035,
    headBobFrequency: 9.5,
    minPitch: -1.2,
    maxPitch: 1.2
  },
  world: {
    groundSize: 600,
    floorHeight: 0
  }
} as const;
