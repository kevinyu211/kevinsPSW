#!/bin/zsh
# Rebuild the island model library from scratch.
#   tools/city3d/island/build.sh              build GLBs + manifest, then every proof render
#   tools/city3d/island/build.sh --no-preview skip the renders
set -e
HERE="${0:A:h}"
BL="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
MODELS="$HERE/../../../designs/city/models"
STYLE="$HERE/../../../docs/designs/city-style"
mkdir -p "$HERE/out" "$HERE/previews" "$MODELS"
cd "$HERE"
[ -d node_modules ] || npm install --no-audit --no-fund
run() { "$BL" -b --factory-startup --python-exit-code 1 --python "$@" 2>&1 | grep -v "INFO\|^$\|^Blender\|Saved:\|Time:" || true; [ ${pipestatus[1]} -eq 0 ]; }

run build_island.py -- all
node finish_island.mjs out "$MODELS"

if [ "$1" != "--no-preview" ]; then
  ./previews.sh
  run island_detailed.py -- film "$STYLE/island-detailed-film.png"
  run island_detailed.py -- model "$STYLE/island-detailed-model.png"
  sips -s format jpeg -s formatOptions 88 -Z 1400 "$STYLE/island-detailed-film.png" --out "$STYLE/island-detailed-film.jpg" >/dev/null
  sips -s format jpeg -s formatOptions 88 -Z 1400 "$STYLE/island-detailed-model.png" --out "$STYLE/island-detailed-model.jpg" >/dev/null
fi
echo "done: $MODELS"
