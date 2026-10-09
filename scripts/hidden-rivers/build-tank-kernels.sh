#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
compiler="${TANK_WASM_CC:-/opt/homebrew/opt/llvm/bin/clang}"
"$compiler" --target=wasm32 -O3 -ffreestanding -fno-builtin -nostdlib src/scripts/hidden-rivers/tank-3d-kernels.c -o public/hidden-rivers/dye-tank/tank-kernels.wasm \
 -Wl,--no-entry,--export-memory,--export=__heap_base,--initial-memory=67108864,--max-memory=134217728,--export=initialize,--export=momentum,--export=buoyancy,--export=pressureKick,--export=projectPrepare,--export=projectFinish,--export=scanExtrema,--export=scalar,--export=poisson
shasum -a 256 src/scripts/hidden-rivers/tank-3d-kernels.c public/hidden-rivers/dye-tank/tank-kernels.wasm
