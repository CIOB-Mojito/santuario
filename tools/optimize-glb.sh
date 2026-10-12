#!/usr/bin/env bash
# Optimiza un GLB ya existente: decima geometria y redimensiona texturas.
# Usado para los modelos aportados por el usuario en la home.
#
# Requisitos: @gltf-transform/cli y @img/sharp-wasm32 (npm), en node_modules/.bin.
# Uso:  bash tools/optimize-glb.sh entrada.glb salida.glb [ratio] [error] [maxTex]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IN="${1:?falta entrada.glb}"
OUT="${2:?falta salida.glb}"
RATIO="${3:-0.25}"
ERROR="${4:-0.005}"
MAXTEX="${5:-512}"

"$ROOT/node_modules/.bin/gltf-transform" optimize "$IN" "$OUT" \
  --simplify true --simplify-ratio "$RATIO" --simplify-error "$ERROR" \
  --texture-size "$MAXTEX" --compress false

ls -l "$OUT" | awk '{print $5, $9}'
