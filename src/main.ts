import { Engine } from './core/Engine';

/**
 * Punto de entrada (seccion 45). Informa con claridad si el dispositivo no
 * puede abrir el mundo, en lugar de dejar una pantalla negra.
 */
function main(): void {
  const app = document.getElementById('app');
  const boot = document.getElementById('boot');

  if (!app) throw new Error('Falta el contenedor #app');

  const test = document.createElement('canvas');
  const gl = test.getContext('webgl2') ?? test.getContext('webgl');
  if (!gl) {
    if (boot) {
      boot.textContent =
        'Este dispositivo no puede abrir Santuario Primordio: falta WebGL. Prueba a actualizar el navegador.';
    }
    return;
  }

  try {
    const engine = new Engine(app);
    engine.start();
    boot?.remove();
    window.addEventListener('beforeunload', () => engine.dispose(), { once: true });

    const params = new URLSearchParams(location.search);
    (window as unknown as { santuario: unknown }).santuario = {
      engine,
      debug: params.has('debug')
    };
  } catch (error) {
    if (boot) {
      boot.textContent = `No se pudo iniciar el santuario: ${error instanceof Error ? error.message : String(error)}`;
    }
    throw error;
  }
}

main();
