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
```

En el telefono, abre la URL de red que imprime Vite en Chrome.

## Estado segun las fases de `o.txt`

- **Fase 1 — Auditar el proyecto:** hecho → `docs/asset-audit.md`.
- **Fase 2 — Buscar y catalogar:** hecho → `docs/asset-sources.md`, consultadas Poly Haven, ambientCG, Sketchfab, Smithsonian, Fab.
- **Fase 3 — Verificar licencias:** hecho → `docs/asset-license-report.md` (todo CC0, atribucion no).
- **Fase 4 — Descargar primer conjunto:** hecho, 7 assets CC0 reales (ver abajo) con md5 verificado.
- **Fase 6 — Integrar texturas PBR:** hecho. Muros=stone_wall_slates, yeso=clay_plaster, suelo=cobblestone_floor_08, madera=dark_wooden_planks, marmol=Marble012, oro=metal tintado; HDRI `citrus_orchard_puresky` como iluminacion ambiental.
- **Fases 5, 7-14:** pendientes (conversion de modelos, arquitectura definitiva, escultura funeraria, exterior/cielo final, streaming/LOD completo, prueba en navegador, correcciones, altares/nuevas zonas).

## Assets reales descargados (CC0, `public/assets/`)

| id | archivo | tamaño |
|---|---|---|
| stone_wall_slates | textures/stone_wall_slates | ~2.1 MB |
| floor_cobblestone | textures/floor_cobblestone | ~1.9 MB |
| wood_dark_planks | textures/wood_dark_planks | ~2.0 MB |
| plaster_wall | textures/plaster_wall | ~1.5 MB |
| marble_012 | textures/marble_012 | ~4.6 MB |
| metal_gold_base | textures/metal_gold_base | ~2.5 MB |
| sky_citrus | sky/sky_citrus (HDRI) | ~1.2 MB |
| character.huesped | characters/Huesped.glb | 0.98 MB *(colaborador)* |
| character.huesped.v2 | characters/Huesped-v2.glb | 5.5 MB *(colaborador)* |

El manifiesto generado: `docs/asset-manifest.json`.

## Que es real y que es provisional

Real: bucle de render, gestion de calidad, zona, colision, streaming con
presupuesto de memoria y carga GLTF real, narrativa sin repeticion, controles
tactiles, cielo procedural, sombras, audio por capas, y **materiales PBR
reales** aplicados a la nave con **HDRI de iluminacion ambiental**.

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
