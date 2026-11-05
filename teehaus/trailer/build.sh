#!/usr/bin/env bash
# Setzt den Trailer zusammen: Szenen (JPEG-Folgen, 1280×720 → 1920×1080), Standbilder der Mini-Spiele mit
# langsamem Zoom, Schlusskarte, Einblendungen mit weichen Überblendungen und die selbst erzeugte Musik.
# Aufruf: bash trailer/build.sh   →   trailer/teehaus-trailer.mp4
set -euo pipefail
cd "$(dirname "$0")"
W=work
O=$W/overlays
S=$W/stills
FPS=30
X=0.6 # Länge der Überblendungen zwischen den Szenen (s)

# ── 1) Einzelclips in 1920×1080
clip() { # name dauer
  ffmpeg -y -v error -framerate $FPS -i "$W/$1/f%04d.jpg" -t "$2" \
    -vf "scale=1920:1080:flags=lanczos,unsharp=5:5:0.4,format=yuv420p" -c:v libx264 -crf 14 -preset medium "$W/c-$1.mp4"
}
clip titel 5
clip anflug 9.5
clip innen 12
clip dorf 12

# Standbilder: langsamer Zoom (Ken Burns), vorher auf doppelte Größe, damit der Zoom nicht ruckelt
still() { # name dauer
  local n=$(echo "$2*$FPS" | bc | cut -d. -f1)
  ffmpeg -y -v error -loop 1 -framerate $FPS -i "$3" -t "$2" \
    -vf "scale=3840:2160:flags=lanczos,zoompan=z='1+0.06*on/$n':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=$FPS,format=yuv420p" \
    -c:v libx264 -crf 14 -preset medium "$W/c-$1.mp4"
}
still tee 4 "$S/tee.png"
still xiangqi 4 "$S/xiangqi.png"
still angeln 4 "$S/angeln.png"
still ende 9 "$O/ende.png"

# ── 2) Szenen aneinander, mit Überblendungen
# Längen: titel 5, anflug 9.5, innen 12, dorf 12, tee 4, xiangqi 4, angeln 4, ende 9 (je 0,6 s Überlappung)
ffmpeg -y -v error \
  -i $W/c-titel.mp4 -i $W/c-anflug.mp4 -i $W/c-innen.mp4 -i $W/c-dorf.mp4 \
  -i $W/c-tee.mp4 -i $W/c-xiangqi.mp4 -i $W/c-angeln.mp4 -i $W/c-ende.mp4 \
  -filter_complex "
    [0][1]xfade=transition=fade:duration=$X:offset=4.4[a];
    [a][2]xfade=transition=fade:duration=$X:offset=13.3[b];
    [b][3]xfade=transition=fade:duration=$X:offset=24.7[c];
    [c][4]xfade=transition=fade:duration=$X:offset=36.1[d];
    [d][5]xfade=transition=fade:duration=$X:offset=39.5[e];
    [e][6]xfade=transition=fade:duration=$X:offset=42.9[f];
    [f][7]xfade=transition=fadeblack:duration=0.9:offset=46.0[g];
    [g]fade=t=in:st=0:d=1.2,fade=t=out:st=53.8:d=1.2[v]" \
  -map "[v]" -c:v libx264 -crf 14 -preset medium $W/basis.mp4
LEN=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $W/basis.mp4)
echo "Grundvideo: $LEN s"

# ── 3) Einblendungen (Bild, Beginn, Ende) mit weichem Ein- und Ausblenden
OVS=(
  "titel 0.9 4.7"
  "anflug 7.6 12.9"
  "innen1 14.2 18.6"
  "bubble 17.8 24.4"
  "wortkarte 19.6 24.6"
  "dorf1 25.6 30.4"
  "dorf2 31.0 35.8"
  "tee 36.4 39.6"
  "xiangqi 39.8 43.0"
  "angeln 43.2 46.2"
  "hinweis 51.6 54.8"
)
INPUTS=(-i $W/basis.mp4)
FILTER=""
LAST="0:v"
k=1
for o in "${OVS[@]}"; do
  read -r name a b <<<"$o"
  d=$(echo "$b - $a" | bc)
  INPUTS+=(-loop 1 -framerate $FPS -t "$d" -i "$O/$name.png")
  FILTER+="[$k:v]format=rgba,fade=t=in:st=0:d=0.6:alpha=1,fade=t=out:st=$(echo "$d - 0.6" | bc):d=0.6:alpha=1,setpts=PTS-STARTPTS+$a/TB[o$k];"
  FILTER+="[$LAST][o$k]overlay=eof_action=pass:enable='between(t,$a,$b)'[v$k];"
  LAST="v$k"
  k=$((k + 1))
done
FILTER=${FILTER%;}

# ── 4) Musik dazu, auf Videolänge, sanft aus
ffmpeg -y -v error "${INPUTS[@]}" -i $W/musik.wav -filter_complex "$FILTER" \
  -map "[$LAST]" -map "$k:a" -t "$LEN" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -r $FPS -movflags +faststart \
  -c:a aac -b:a 192k -af "afade=t=out:st=$(echo "$LEN - 2" | bc):d=2" \
  teehaus-trailer.mp4
ls -la teehaus-trailer.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact teehaus-trailer.mp4
