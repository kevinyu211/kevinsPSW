#!/bin/zsh
# Proof renders in film-look light, from the exported raw GLBs: contact sheets of every model, and close-ups.
HERE="${0:A:h}"
BL="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
cd "$HERE"
pv() { "$BL" -b --factory-startup --python preview_island.py -- "$@" 2>&1 | grep -i "error\|traceback" ; }
B=buildings.raw.glb; P=props.raw.glb
pv sheet $B sheet-1-software.png 3 96 'b_hirvo*' 'b_trade*' 'b_court*' 'b_uhome*' 'b_pindou*' &
pv sheet $B sheet-2-books.png 3 86 'b_books*' 'b_bookflow*' 'b_ipad*' &
pv sheet $B sheet-3-film.png 3 86 'b_yae*' 'b_noir*' 'b_influencers*' &
pv sheet $B sheet-4-games-health.png 3 86 'b_stickers*' 'b_party*' 'b_duiyao*' 'b_hackathons*' &
wait
pv sheet $B sheet-5-levels.png 3 76 lot site_small site_large &
pv sheet $B sheet-6-stations.png 2 84 station station_main &
pv sheet $B sheet-7-tower.png 1 80 tower &
pv sheet $P sheet-8-vehicles-boats.png 5 20 train_end train_mid tram bus car_a car_b car_c boat_sail boat_fishing ferry &
pv sheet $P sheet-9-houses-trees.png 5 16 house_a house_b house_c house_d lighthouse tree_a tree_b tree_c tree_pine palm streetlamp &
pv sheet $P sheet-10-animals-beach.png 4 4.2 gull dolphin sheep deer dog bench umbrella sunbed &
wait
for id in hirvo trade court uhome pindou books bookflow ipad yae noir influencers stickers party duiyao hackathons; do
  pv close $B close-$id-L4.png b_${id}_L4 28 13 1.55 &
  pv close $B close-$id-L5.png b_${id}_L5 -24 16 1.5 &
  [ $id = uhome ] && wait; [ $id = ipad ] && wait; [ $id = stickers ] && wait
done
wait
pv close $B close-station.png station 30 12 1.5 &
pv close $B close-station_main.png station_main 26 12 1.5 &
pv close $B close-site_large.png site_large 28 14 1.4 &
pv close $P close-train_end.png train_end 35 12 1.5 &
pv close $P close-tram.png tram 35 12 1.5 &
pv close $B close-tower.png tower 12 9 1.0 &
pv close $P close-lighthouse.png lighthouse 28 10 1.4 &
wait
# ---- models placed together: the floating train, the docks, the ring gates, and the restyled vehicles and props
sv() { "$BL" -b --factory-startup --python preview_scene.py -- "$@" 2>&1 | grep -i "error\|traceback" ; }
TR=(p:train_end@-14.6,10,2.1,180 p:train_mid@0,10,2.1 p:train_end@14.6,10,2.1)       # a 3-car train stopped in a station, on the z = +2.1 lane
T0=(p:train_end@-14.6,0,0,180 p:train_mid@0,0,0 p:train_end@14.6,0,0)
sv scene-train-side.png 0 3 1 res=2200x420 dist=62 ground=-6 look=0,1.9,0 $T0 &
sv scene-train-three-quarter.png 38 12 1 dist=48 ground=-8 look=2,1.8,0 $T0 &
sv scene-train-nose.png 22 8 1 dist=20 ground=-6 look=3.8,1.8,0 p:train_end &
sv scene-train-underside.png 40 -18 1 dist=24 ground=none look=2,1.8,0 p:train_end &
sv scene-train-doors-open.png 25 10 1 dist=30 ground=-6 look=0,1.8,0 open=1 p:train_mid p:train_end@14.6,0,0 &
wait
sv scene-station-docked-end.png 90 -4 1 dist=55 look=0,9.5,0 lens=60 b:station $TR &
sv scene-station-docked.png 25 22 1 dist=75 look=0,10,0 b:station $TR &
sv scene-station-below.png 60 -14 1 dist=50 look=0,8.5,0 lens=35 ground=none b:station $TR &
sv scene-station-gates.png 0 6 1 dist=4.3 look=-7.3,12.1,3.4 lens=14 res=1800x800 b:station $TR &
sv scene-station-gates-open.png 0 6 1 dist=4.3 look=-7.3,12.1,3.4 lens=14 res=1800x800 open=1 b:station $TR &
wait
sv scene-main-station-docked.png 25 24 1 dist=110 look=0,8,5 b:station_main $TR p:tram@0,0.3,-16.7 &
sv scene-main-station-end.png 90 3 1 dist=70 look=0,11,0 lens=60 b:station_main $TR &
sv scene-pod-main-dock.png 180 12 1 dist=34 look=0,2,-16 b:station_main p:tram@0,0.3,-16.7 &
sv scene-pod.png 35 12 1 dist=20 ground=-4 look=0,1.7,0 p:tram &
sv scene-pod-dock.png 150 16 1 dist=28 look=0,2,1 p:tram_stop p:tram &
sv scene-pod-dock-end.png 90 8 1 dist=20 look=0,1.5,1 p:tram_stop p:tram &
wait
sv scene-ring.png 62 8 1 dist=34 ground=-10 look=17,2,2.1 p:lane_ring@24,1.97,2.1 p:train_end@-14.6,0,2.1,180 p:train_mid@0,0,2.1 p:train_end@14.6,0,2.1 &
sv scene-ring-double.png 30 10 1 dist=60 ground=-10 look=6,2,0 p:lane_ring_double@24,1.97,0 p:lane_ring_double@-12,1.97,0 p:train_end@-14.6,0,2.1,180 p:train_mid@0,0,2.1 p:train_end@14.6,0,2.1 p:train_end@-24.6,0,-2.1,180 p:train_mid@-10,0,-2.1 p:train_end@4.6,0,-2.1 &
sv scene-night.png 40 6 1 dist=60 ground=0 look=6,11,0 night=1 p:lane_ring_double@26,11.97,0 p:lane_ring_double@-30,11.97,0 $TR &
sv scene-cars.png 35 18 1 dist=30 look=0,1.2,2 p:car_a@-9,0,-3 p:car_b@-1,0,-3 p:car_c@7,0,-3 p:bus@0,0,5 &
sv scene-cars-back.png 150 14 1 dist=30 look=0,1.2,2 p:car_a@-9,0,-3 p:car_b@-1,0,-3 p:car_c@7,0,-3 p:bus@0,0,5 &
wait
sv scene-ferry.png 35 14 1 dist=62 look=0,4,0 ground=-1.4 p:ferry &
sv scene-boats.png 35 12 1 dist=34 look=0,4,0 ground=-1.0 p:boat_sail@-7,0,0 p:boat_fishing@7,0,0 &
sv scene-beach.png 35 22 1 dist=10 look=0,1.2,0 p:umbrella@-1,0,0 p:sunbed@2.2,0,0.5 p:sunbed@-1.5,0,2.5,90 &
sv scene-lot.png 28 24 1 dist=62 look=0,2,0 b:lot &
sv scene-site-small.png 28 16 1 dist=85 look=4,10,0 b:site_small &
sv scene-site-large.png 28 16 1 dist=130 look=6,16,0 b:site_large &
wait
"$BL" -b --factory-startup --python island_detailed.py -- film previews/close-tower-base.png 7 0 150 "0,6,64" 2>&1 | grep -i "error\|traceback"
echo "previews written to $HERE/previews"
./beauty.sh
