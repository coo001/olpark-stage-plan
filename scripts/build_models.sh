#!/bin/sh
# 실감형 콘텐츠(공공데이터포털 15127487) GLB를 웹용으로 줄인다.
# 원본: https://www.ksponco.or.kr/attachFiles/download/kspo/{88_glb,woori_glb}.zip
# 필요: Node 18+, npx @gltf-transform/cli
# 사용: sh scripts/build_models.sh <원본 88JandiMadang.glb> <원본 WooriArtHall.glb>
set -e
OUT="$(dirname "$0")/../models"
TMP="$(mktemp -d)"
export NODE_OPTIONS=--max-old-space-size=8192

# 1) 원본 재질(KHR_materials_pbrSpecularGlossiness)을 three.js가 읽는 metal/rough로 바꾼다
# 2) 정점 단순화 + meshopt 압축 + 텍스처 webp
npx gltf-transform metalrough "$1" "$TMP/88.glb"
npx gltf-transform optimize "$TMP/88.glb" "$OUT/88.glb" \
  --compress meshopt --texture-compress webp --texture-size 1024 \
  --simplify-ratio 0.5 --simplify-error 0.0005 --instance false

npx gltf-transform metalrough "$2" "$TMP/woori.glb"
npx gltf-transform optimize "$TMP/woori.glb" "$OUT/woori.glb" \
  --compress meshopt --texture-compress webp --texture-size 512 \
  --simplify-ratio 0.08 --simplify-error 0.002 --instance false

# file:// 로 열 때를 위해 base64 스크립트 사본을 만든다
node "$(dirname "$0")/wrap_models.mjs"
rm -rf "$TMP"
