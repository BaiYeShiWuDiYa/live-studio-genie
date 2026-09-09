#!/usr/bin/env bash
set -euo pipefail

export npm_config_registry="${NPM_CONFIG_REGISTRY:-http://bnpm.byted.org}"
export npm_config_dist_url="${NPM_CONFIG_DIST_URL:-https://bnpm.bytedance.net/mirrors/node}"

npm ci
npm run build:goofy
