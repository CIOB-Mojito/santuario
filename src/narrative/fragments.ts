import type { Fragment } from './NarrativeSystem';

/**
 * Datos narrativos separados del codigo de escena (seccion 32). Mas adelante
 * esto podra venir de un JSON externo; de momento vive en un modulo de datos.
 */
export const FRAGMENTS: readonly Fragment[] = [
  {
    zoneId: 'exterior',
    text: 'El camino de tierra aun guarda la forma de los pies que llegaron antes. El cielo pesa, limpio, como una promesa dicha en verano.'
  },
  {
    zoneId: 'exterior',
    text: 'Aqui el aire huele a piedra caliente. La fachada se alza sin prisa: no pide que entres, solo deja de esconderse.'
  },
  {
    zoneId: 'nave',
    text: 'Dentro, la luz cambia de color. El exterior queda como un recuerdo brillante detras de ti.'
  },
  {
    zoneId: 'nave',
    text: 'La nave de la primera memoria no cuenta una historia: sostiene el silencio donde una historia podria empezar.'
  },
  {
    zoneId: 'nave',
    text: 'Dos figuras velan el altar. No te miran. Su paciencia es mas antigua que el techo.'
  }
];
