# Santuario Primordio

Experiencia 3D interactiva para movil, construida en Termux (Android). Un
recorrido breve por un santuario monumental: exterior luminoso de verano, un
umbral, y una nave en penumbra calida.

La especificacion completa vive en `o.txt` (raiz del home): una **mision de
assets reales** (localizar, verificar licencias, descargar, optimizar e
integrar). No se aceptan placeholders como resultado: cada recurso cuenta como
implementado solo si existe, tiene licencia comprobada, se carga y aparece en la
escena.

## Nota sobre el motor (desvio respecto a `o.txt`)

`o.txt` indica **Babylon.js**; el proyecto actual está en **three.js** (como se
vino construyendo). Los assets (GLB + texturas PBR + HDRI) son agnósticos del
motor. Pendiente de decisión: migrar a Babylon.js o mantener three.js.

## Stack

- **Vite 8** (dev server + build) — verificado funcionando en Android.
- **TypeScript 5.9** estricto (`strict`, `noUnusedLocals`, sin `any`).
- **three.js 0.186**.
- Smoke test propio con **esbuild** sobre `tools/smoke.ts`.
- Descargador de assets: `tools/fetch-assets.mjs` (Poly Haven + ambientCG, CC0).

TypeScript 7 no corre en Termux (falta el binario nativo para Android).

## Uso

```bash
npm install
npm run dev        # servidor de desarrollo (red: http://<ip>:5173)
npm run build      # typecheck + build de produccion
npm run typecheck  # solo tipos
npm run smoke      # pruebas de logica sin navegador
npm run check      # typecheck + build + smoke
node tools/fetch-assets.mjs            # descarga CC0 (md5 verificado, actualiza manifest)
bash tools/fetch-models.sh             # descarga+convierte+optimiza modelos CC0 (OpenGameArt)
```

En el telefono, abre la URL de red que imprime Vite en Chrome.

## Estado segun las fases de `o.txt`

- **Fase 1 — Auditar el proyecto:** hecho → `docs/asset-audit.md`.
- **Fase 2 — Buscar y catalogar:** hecho → `docs/asset-sources.md`, consultadas Poly Haven, ambientCG, Sketchfab, Smithsonian, Fab.
- **Fase 3 — Verificar licencias:** hecho → `docs/asset-license-report.md` (todo CC0, atribucion no).
- **Fase 4 — Descargar primer conjunto:** hecho, 7 texturas/HDRI CC0 (md5 verificado) + 10 modelos CC0 de OpenGameArt.
- **Fase 5 — Optimizar modelos:** hecho. `assimp`→GLB (`tools/convert-model.py`) y `gltf-transform` (estatua 66 MB → 0.58 MB).
- **Fase 6 — Integrar texturas PBR y modelos:** hecho. Materiales PBR en la nave + HDRI; estatuas (marmol, caballero yacente), mausoleo, sepulcro, candelabro y 6 lapidas colocados desde `src/world/placements.ts`, sustituyendo los placeholders.
- **Fases 7-14:** pendientes (arquitectura definitiva, angel funerario de calidad, exterior/cielo final, streaming/LOD fino, prueba en navegador, correcciones, nuevas zonas).

## Assets reales (CC0, `public/assets/`)

Texturas y HDRI: `stone_wall_slates`, `floor_cobblestone`, `wood_dark_planks`,
`plaster_wall`, `marble_012`, `metal_gold_base` y HDRI `sky_citrus`.

Modelos (OpenGameArt, CC0; convertidos/optimizados): `statues/marble_statue.glb`
(Daniel Andersson), `statues/knight_effigy.glb` (yd), `props/mausoleum.glb`
(Paul Wortmann), `props/tomb.glb` (zerberros), `props/candles.glb` (AnyRPG) y
`props/grave_1..6.glb` (Savino).

Modelos del colaborador (licencia por verificar): `characters/Huesped.glb` y
`Huesped-v2.glb`.

Manifiestos: `docs/asset-manifest.json`, `docs/asset-sources.md`,
`docs/asset-license-report.md`, `docs/asset-audit.md`.

## Que es real y que es provisional

Real: bucle de render, gestion de calidad, zona, colision, streaming con
presupuesto de memoria y carga GLTF real, narrativa sin repeticion, controles
tactiles, cielo procedural, sombras, audio por capas, **materiales PBR
reales** con **HDRI de iluminacion ambiental**, y **modelos reales** (estatuas,
mausoleo, sepulcro, candelabro, lapidas) colocados en el mundo.

Provisional: la geometria de la nave (muros, columnas, altar) sigue siendo
volumetria modular intermedia con los materiales PBR ya asignados; las
esculturas siguen siendo figuras de cilindro. Pendientes: escultura/ángel CC0,
props ornamentales, audio, arquitectura definitiva, prueba visual en el
dispositivo.

## Bloqueos conocidos

- Sketchfab y Fab exigen autenticacion/autorizacion: se registra el bloqueo y se
  busca en fuentes accesibles (OpenGameArt, Smithsonian), sin inventar APIs.
- No hay navegador headless en el entorno: la prueba visual (FASE 11) requiere
  abrir la URL en Chrome Android.
- Los GLB `Huesped*` del colaborador no tienen licencia registrada → por
  verificar antes de publicar con esos modelos.

## Integracion del commit del colaborador

El remoto tenia `8f55b36 "feat: add free camera and GLB statues"` sobre la
arquitectura anterior (Vite no, `src/scene/`). Se integro con un merge que
**preserva ese commit en el historial** pero mantiene la arquitectura nueva de
`o.txt`; solo se reincorporaron los modelos, movidos a `public/assets/`.
