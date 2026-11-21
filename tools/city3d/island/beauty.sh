#!/bin/zsh
# Beauty renders with the real materials (sky reflections, see-through glass, soft sun): previews/beauty-*.png
HERE="${0:A:h}"
BL="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
cd "$HERE"
bv() { "$BL" -b --factory-startup --python preview_scene.py -- "$@" beauty=1 2>&1 | grep -i "error\|traceback" ; }
PAVE="gcol=0.46,0.47,0.45"; GRASS="gcol=0.30,0.44,0.20"
T0=(p:train_end@-14.6,0,0,180 p:train_mid@0,0,0 p:train_end@14.6,0,0)
TR=(p:train_end@-14.6,10,2.1,180 p:train_mid@0,10,2.1 p:train_end@14.6,10,2.1)
bv beauty-train-side.png 0 3 1 res=2200x440 dist=70 ground=-3 $PAVE look=0,1.9,0 $T0 &
bv beauty-train-three-quarter.png 38 10 1 res=1500x900 dist=44 ground=-3 $PAVE look=5,1.8,0 $T0 &
bv beauty-train-nose.png 62 7 1 res=1500x900 dist=17 ground=-3 $PAVE look=5.5,1.8,0 p:train_end &
bv beauty-pod.png 35 10 1 res=1500x900 dist=17 ground=-2 $PAVE look=0,1.7,0 p:tram &
wait
bv beauty-station-street.png 20 12 1 $PAVE res=1500x900 dist=78 look=-3,7,3 b:station $TR &
bv beauty-station-entrance.png -28 9 1 $PAVE res=1500x900 dist=30 look=-12,3.5,9 lens=30 b:station $TR &
bv beauty-station-platform.png 35 8 1 $PAVE res=1500x900 dist=4.6 look=-11.1,12.3,3.4 lens=16 open=1 b:station $TR &
bv beauty-station-back.png 160 14 1 $PAVE res=1500x900 dist=78 look=2,7,-2 b:station $TR &
wait
bv beauty-station-main.png 25 20 1 $PAVE res=1500x900 dist=120 look=0,8,6 b:station_main $TR p:tram@0,0.3,-16.7 &
bv beauty-station-main-platform.png 90 14 1 $PAVE res=1500x900 dist=46 look=8,12,0 lens=40 open=1 b:station_main $TR &
bv beauty-tower.png 15 6 1 $GRASS res=900x1500 dist=330 look=0,95,0 lens=50 b:tower &
bv beauty-tower-base.png 12 6 1 $GRASS res=1500x900 dist=75 look=0,9,10 lens=35 b:tower &
wait
bv beauty-building-software.png 28 13 1.5 $GRASS res=1500x900 b:b_hirvo_L5 &
bv beauty-building-books.png 28 13 1.5 $GRASS res=1500x900 b:b_books_L4 &
bv beauty-building-film.png 28 13 1.5 $GRASS res=1500x900 b:b_yae_L4 &
bv beauty-building-games.png 28 13 1.5 $GRASS res=1500x900 b:b_party_L4 &
bv beauty-building-health.png 28 13 1.5 $GRASS res=1500x900 b:b_duiyao_L4 &
wait
echo "beauty renders written to $HERE/previews"
