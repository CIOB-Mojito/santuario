import { Engine } from './core/Engine';

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function boot(): void {
  const container = document.getElementById('app');
  const bootMsg = document.getElementById('boot');
  if (!container) return;

  if (!hasWebGL()) {
    if (bootMsg) bootMsg.textContent = 'Este dispositivo no soporta WebGL. Probá con otro navegador.';
    return;
  }

  try {
    const engine = new Engine(container);
    window.addEventListener('beforeunload', () => engine.dispose(), { once: true });
    bootMsg?.remove();
  } catch (error) {
    console.error('[santuario] fallo al iniciar', error);
    if (bootMsg) bootMsg.textContent = 'No se pudo iniciar el santuario. Revisá la consola.';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
