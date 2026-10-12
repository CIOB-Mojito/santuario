# Fuentes de assets — Santuario Primordio

Estado 2026-10-12. Solo se registra lo que se ha consultado de verdad.

## Poly Haven — https://polyhaven.com  (todas las texturas/HDRI son CC0, sin atribución)

| categoría | encontrado | seleccionado | estado |
|---|---|---|---|
| Texturas piedra/pizarra | decenas (castle_wall_slates, cobblestone_*, brick_*, …) | stone_wall_slates | descargada + integrada |
| Suelos | cobblestone_floor_01..13 y más | cobblestone_floor_08 | descargada + integrada |
| Madera | dark_wooden_planks, brown_planks_*, … | dark_wooden_planks | descargada + integrada |
| Yeso | clay_plaster, blue_plaster_* | clay_plaster | descargada + integrada |
| HDRI cielo | puresky/clear/midday varios | citrus_orchard_puresky | descargado + entorno |
| Mármol/Oro | no disponibles como textura en Poly Haven | — | pasar a ambientCG |

Verificación: API `api.polyhaven.com/assets` y `files` responden 200; las URL de
descarga se han comprobado y los md5 publicados coinciden con lo descargado.

## ambientCG — https://ambientcg.com  (CC0, sin atribución)

| categoría | encontrado | seleccionado | estado |
|---|---|---|---|
| Mármol | Marble006/012/016/021, Travertine009, … | Marble012 | descargado + integrado |
| Metal (base de oro tintada en material) | Metal007/034/042A/048A/B/C | Metal048A | descargado + integrado |
| Yeso/Plaster | Plaster001/002/007, PaintedPlaster017 | (cubierto por Poly Haven) | — |

Descarga por URL directa estable: `https://ambientcg.com/get?file=<Id>_1K-JPG.zip`.

## Sketchfab — https://sketchfab.com

- Candidatos localizados: "Stone Angel Statue / Cemetery Angel / Gothic Statue /
  Medieval Altar" (incl. el modelo de Jim Wing sugerido en o.txt).
- No descargado: requiere cuenta con autorización por parte del autor para
  descargas; no se puede verificar licencia ni descargar sin autenticación.
  **Bloqueo registrado** (sec. 22); alternativa: OpenGameArt / Smithsonian / CC
  Search.

## Smithsonian 3D — https://3d.si.edu

- Endpoint de paquete 3D consultado directamente dio 404 (requiere el UUID
  correcto del objet de colección). Pendiente de re-verificar con el catálogo.
  Prioridad: modelos con licencia CC0 confirmada.

## Fab — https://www.fab.com

- "Gothic Cathedral Environment" y "Dark Fantasy Gothic Cathedral Environment"
  identificados. Requieren cuenta/login y licencia por título; no se puede
  reutilizar sin compra/licencia explícita. **Bloqueado por autenticación.**

## OpenGameArt — https://opengameart.org  (accesible, HTTP 200)

- Pendiente de rastreo sistemático: medieval church, statue, gargoyle, candles,
  tombstone. Priorizar CC0 y formatos convertibles a glTF.

## Criterio de selección (sec. 4 de o.txt)

Combinación de calidad visual, polígonos, texturas PBR, escala, licencia,
comercial permitido y rendimiento previsto en Android. No se elige algo solo por
ser gratuito.