#!/bin/bash
set -Eeuo pipefail

# Gant Exec
chmod a+x ./src/shell/*

# Get Top MOD ID From Steam Workshop
bash ./src/shell/get_most_use_workshop_item.sh

# Check MOD Version
# Download MOD
# Cache MOD

npx ts-node src/ts/index.ts
