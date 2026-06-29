#!/usr/bin/env bash
# scripts/build.sh —— src/ → dist/realhome-<hash>.mjs；in-place 改 index.html 引新 hash。
# 抄自 WebPaint scripts/build.sh（家族 mature paradigm），改 ENTRY + bundle 名 + externals。
#
# 用法：编辑 src/ → 跑这个 → git commit && git push origin main
#   (push main → GH Actions 部署到 /dev/；promote 到 prod 见 docs/20260625-dev-prod-split.md)
#
# RealHome 差异 vs WebPaint：
#   - three / three-mesh-bvh / @azure/msal-browser 走 importmap 在运行时解析，**不进 bundle**
#     （= WebPaint "vendor 不打进 bundle" 原则在 ES-module importmap 下的形态）。下面 --external
#     把它们留成裸 specifier；index.html 的 <script type="importmap"> 仍然要在、仍然指向 src/vendor。
#   - 还没迁 TS：ENTRY=./src/app.js。将来某个 .js → .ts 时，esbuild 自动 strip 类型；把下面的
#     tsc --noEmit 门配好（装 tsconfig + node_modules/.bin/tsc）就有真类型护栏了。

set -euo pipefail
cd "$(dirname "$0")/.."

ENTRY="./src/app.js"
OUT_DIR="./dist"
ESBUILD_VER="0.24.0"
ESBUILD="./tools/esbuild/esbuild"

# vendor 库走 importmap 运行时解析 → 不打进 bundle。必须和 index.html 的 importmap keys 一致。
EXTERNALS=(
  --external:three
  --external:three/*
  --external:three-mesh-bvh
  --external:@azure/msal-browser
)

# 没 esbuild 自动 curl 一份（tools/esbuild/ gitignored；跨 OS 不通用故不入 git）。
if [ ! -x "$ESBUILD" ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64)   plat="linux-x64" ;;
    Linux-aarch64)  plat="linux-arm64" ;;
    Darwin-arm64)   plat="darwin-arm64" ;;
    Darwin-x86_64)  plat="darwin-x64" ;;
    *) echo "[build] 未知平台 $(uname -s)-$(uname -m)，手 vendor esbuild 进 $ESBUILD" >&2; exit 1 ;;
  esac
  echo "[build] 拉 esbuild $plat-$ESBUILD_VER..."
  mkdir -p tools/esbuild
  TMP=$(mktemp -d)
  curl -sL "https://registry.npmjs.org/@esbuild/${plat}/-/${plat}-${ESBUILD_VER}.tgz" | tar -xz -C "$TMP"
  mv "$TMP/package/bin/esbuild" "$ESBUILD"
  chmod +x "$ESBUILD"
  rm -rf "$TMP"
fi

mkdir -p "$OUT_DIR"
TMP_OUT="$OUT_DIR/realhome-tmp.mjs"

# 0. 类型检查门（TS-ready）：装了 tsc 就强制过；裸 clone（无 node_modules）静默跳过。
#    今天还没 TS，这块是占位——迁 TS 后加 tsconfig.json + npm i typescript 即生效。
TSC="./node_modules/.bin/tsc"
if [ -x "$TSC" ]; then
  echo "[build] 类型检查 tsc --noEmit…"
  "$TSC" --noEmit -p tsconfig.json || { echo "[build] 类型检查失败，已挡下构建。" >&2; exit 1; }
  echo "[build] 类型通过"
fi

# 1. esbuild bundle 到临时名（vendor externals 留裸 specifier）
"$ESBUILD" "$ENTRY" \
  --bundle --format=esm --target=es2020 \
  --minify --sourcemap=linked \
  --tree-shaking=true \
  "${EXTERNALS[@]}" \
  --outfile="$TMP_OUT"

# 2. content hash 截 12 位作文件名
HASH=$(sha256sum "$TMP_OUT" | awk '{print substr($1, 1, 12)}')
OUT="$OUT_DIR/realhome-$HASH.mjs"

# 3. mv 到最终名
mv "$TMP_OUT"     "$OUT"
mv "$TMP_OUT.map" "$OUT.map"

# 老 hashed bundle 清掉，不堆积
find "$OUT_DIR" -maxdepth 1 -name 'realhome-*.mjs'     -not -name "realhome-$HASH.mjs"     -delete
find "$OUT_DIR" -maxdepth 1 -name 'realhome-*.mjs.map' -not -name "realhome-$HASH.mjs.map" -delete

# 4. sed 改 index.html 入口指向新 hash（匹配 PLACEHOLDER 大写 或 hex hash）
if grep -q 'src="./dist/realhome-' index.html; then
  sed -i "s|src=\"./dist/realhome-[A-Za-z0-9-]*\\.mjs\"|src=\"./dist/realhome-$HASH.mjs\"|" index.html
else
  echo "[build] 警告：index.html 里没找到 ./dist/realhome-*.mjs script tag（先把 <script> 换成它）" >&2
fi

size=$(stat -c%s "$OUT" 2>/dev/null || wc -c < "$OUT")
echo "[build] $OUT ($size bytes, hash=$HASH)"
echo "[build] 完成。提交：git add . && git commit && git push origin main  (→ /dev/)"
