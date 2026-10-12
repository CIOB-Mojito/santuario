# Santuario Primordio

Experiencia 3D interactiva para movil, construida en Termux (Android). Un
recorrido breve por un santuario monumental: exterior luminoso de verano, un
umbral, y una nave en penumbra calida.

El diseno completo vive en `o.txt` (raiz del home). Este repositorio avanza por
fases; no se pretende construir todo de una vez.

## Stack

- **Vite 8** (dev server + build) — verificado funcionando en Android.
- **TypeScript 5.9** estricto (`strict`, `noUnusedLocals`, sin `any`).
- **three.js 0.186**.
- Smoke test propio con **esbuild** sobre `tools/smoke.ts`.

TypeScript 7 no corre en Termux (falta el binario nativo para Android).

## Uso

```bash
npm install
npm run dev        # servidor de desarrollo (red: http://<ip>:5173)
npm run build      # typecheck + build de produccion
npm run typecheck  # solo tipos
npm run smoke      # pruebas de logica sin navegador
npm run check      # typecheck + build + smoke
```

En el telefono, abre la URL de red que imprime Vite en Chrome.

## Estado por fases

- **Fase 1 — Proyecto base:** hecho. Arranca, renderiza y detecta ausencia de WebGL con mensaje claro.
- **Fase 2 — Arquitectura de carpetas:** hecho. `core/ config/ assets/ streaming/ world/ lighting/ effects/ interaction/ audio/ player/ narrative/ ui/ debug/`.
- **Fase 3 — Camara y controles tactiles:** hecho. Camara FPS con balanceo de cabeza, joystick virtual, area de mirada e interaccion por toque.
- Fases 4-14 (assets reales, streaming de modelos, LOD, materiales PBR, iluminacion final, seccion definitiva, optimizacion, evaluacion, narrativa completa, segunda zona): **pendientes**.

Controles: joystick en la mitad izquierda, mirada en la mitad derecha, toque
sin arrastre interactua. En escritorio: WASD/flechas, Shift para correr,
arrastrar para mirar, E para interactuar.

## Que es real y que es provisional

Real: bucle de render, gestion de calidad, zona, colision, streaming (politica y
presupuesto), narrativa sin repeticion, controles, cielo procedural, sombras y
audio por capas (sin muestras todavia).

Provisional: la geometria de la nave son masas con materiales intencionados pero
sin texturas ni modelos. Los assets del `AssetRegistry` apuntan a `null`: el
streaming no carga nada hasta que existan recursos reales. La lista de assets
gratuitos (Poly Haven, ambientCG, Sketchfab, etc.) se integrara en la fase de
assets.
