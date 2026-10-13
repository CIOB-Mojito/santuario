/**
 * Colocacion de los modelos reales cargados por el streaming (secciones 15, 16
 * y 21 de o.txt). Cada entrada define donde y como aparece el recurso en el
 * mundo. Los modelos con `targetHeight` se normalizan a esa altura; si es null
 * se respeta la escala de origen (personajes ya vienen a escala humana).
 *
 * La componente Y de `position` es un DESPLAZAMIENTO sobre el suelo real: el
 * pipeline (Engine.placeLoadedAsset) muestrea la superficie en (x, z) y apoya
 * los pies encima, de modo que un 0 significa "sobre el suelo" tanto dentro de
 * la nave (losa a y=0.4) como en el exterior.
 *
 * `rotationX` corrige modelos exportados con el eje vertical equivocado (p. ej.
 * estatuas Z-up que llegan tumbadas); `remove` descarta nodos ayudantes de
 * Blender (dominios de simulacion, camaras) que inflan la caja y la escala.
 *
 * Coordenadas del mundo: la nave discurre por z (-32..32), ancho +-9, el altar
 * esta al fondo (z=-29). El exterior es el resto del terreno.
 */
export interface Placement {
  readonly position: readonly [number, number, number];
  readonly rotationY?: number;
  readonly rotationX?: number;
  readonly targetHeight?: number | null;
  readonly label?: string;
  readonly remove?: readonly string[];
}

export const PLACEMENTS: Readonly<Record<string, Placement>> = {
  'character.huesped': { position: [-2.2, 0, -8], rotationY: Math.PI, targetHeight: 1.85, label: 'El Huesped' },
  'character.huesped.v2': { position: [2.2, 0, -8], rotationY: Math.PI, targetHeight: 1.85, label: 'El Huesped II' },

  'statue.marble': { position: [-4.6, 0, -26], rotationX: -Math.PI / 2, rotationY: 0.35, targetHeight: 3.2, label: 'Vigilante de marmol' },
  'statue.effigy': { position: [0, 0, -21], rotationY: 0, targetHeight: 1.2, label: 'Caballero yacente' },

  'props.candles': { position: [0, 0, -29.4], rotationY: 0, targetHeight: 1.5, label: 'Candelabro del altar', remove: ['Domain', 'Camera'] },
  'props.mausoleum': { position: [-22, 0, -18], rotationY: 0.8, targetHeight: 6 },
  'props.tomb': { position: [18, 0, -8], rotationY: -0.4, targetHeight: 1.6 },
  'props.grave.1': { position: [12, 0, 8], rotationY: -0.3, targetHeight: 1.3 },
  'props.grave.2': { position: [15, 0, 12], rotationY: 0.2, targetHeight: 1.1 },
  'props.grave.3': { position: [-13, 0, 10], rotationY: 0.5, targetHeight: 1.2 },
  'props.grave.4': { position: [-16, 0, 15], rotationY: -0.6, targetHeight: 1.4 },
  'props.grave.5': { position: [11, 0, 20], rotationY: 0.1, targetHeight: 1.2 },
  'props.grave.6': { position: [-12, 0, 22], rotationY: -0.2, targetHeight: 1.5 },

  'statue.angel_vcu': { position: [-26, 0, -4], rotationY: 0.6, targetHeight: 2.4, label: 'Angel de piedra' },
  'statue.angel_frances': { position: [26, 0, -10], rotationY: -0.7, targetHeight: 2.4, label: 'Angel del recuerdo' },
  'statue.wooden_angel': { position: [-6.6, 0, -10], rotationY: 1.4, targetHeight: 3.6, label: 'Angel de madera' },
  'statue.monument_angel': { position: [-34, 0, 26], rotationY: 0.4, targetHeight: 9, label: 'Monumento antiguo' },
  'props.fountain_putti': { position: [0, 0, 22], rotationY: 0, targetHeight: 3.6, label: 'Fuente de los putti' },

  'props.mystery_box_premium': { position: [6, 0, 37], rotationY: Math.PI, targetHeight: 0.9, label: 'Caja Premium' }
};
