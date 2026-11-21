#!/bin/zsh
# Rebuild the Transit city model library from scratch.
#   tools/city3d/build.sh            build GLBs + manifest, then the proof renders
#   tools/city3d/build.sh --no-preview   skip the renders
set -e
HERE="${0:A:h}"
BL="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
MODELS="$HERE/../../designs/transit/models"
mkdir -p "$HERE/out" "$HERE/previews" "$MODELS"
cd "$HERE"
run() { "$BL" -b --factory-startup --python-exit-code 1 --python "$@" 2>&1 | grep -v "INFO\|^$\|^Blender" || true; [ ${pipestatus[1]} -eq 0 ]; }

run build_all.py -- all
cp out/kit.raw.glb "$MODELS/kit.glb"
cp out/landmarks.raw.glb "$MODELS/landmarks.glb"
node finish.mjs out "$MODELS"

if [ "$1" != "--no-preview" ]; then
  run preview.py -- kit
  run preview.py -- props
  run preview.py -- kitclose midrise,lowrise 60
  run preview.py -- kitclose shop,house,civic,industrial 70
  run preview.py -- landmarks
  run preview.py -- one k_tower
  run preview.py -- one hq_hirvo hq_trade hq_court hq_uhome hq_books hq_ipad
  run preview.py -- one hq_yae hq_noir hq_influencers hq_stickers hq_party hq_duiyao
  run preview.py -- one hq_hackathons hq_pindou hq_resume hq_news hq_nonstop plot_empty
  run preview.py -- one station_elevated station_grade
  run preview.py -- skyline
fi
echo "done: $MODELS"
