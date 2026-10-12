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

Real: bucle de render, gestion de calidad, zona, colision, streaming con
presupuesto de memoria y carga GLTF real, narrativa sin repeticion, controles,
cielo procedural, sombras y audio por capas (sin muestras todavia).

Integrado del colaborador: `public/assets/characters/Huesped.glb` (0.9 MB) y
`Huesped-v2.glb` (5.5 MB). Se cargan con `GLTFLoader`, se normalizan a escala
humana y se apoyan en el suelo de la nave. Con el presupuesto movil actual
(3 MB), solo entra el modelo ligero; el pesado queda en cola a proposito.

Provisional: la geometria de la nave son masas con materiales intencionados pero
sin texturas. La lista de assets gratuitos (Poly Haven, ambientCG, Sketchfab,
etc.) se integrara en la fase de assets.

## Integracion del commit del colaborador

El remoto tenia `8f55b36 "feat: add free camera and GLB statues"` sobre la
arquitectura anterior (Vite no, `src/scene/`). Se integro con un merge que
**preserva ese commit en el historial** pero mantiene la arquitectura nueva de
`o.txt`; solo se reincorporaron los modelos, movidos a `public/assets/`.
