#!/bin/bash

set -e

SCHEMA_TARGETS=(
    "//core/api:update-public-schema"
    "//core/api:update-admin-schema"
    "//core/api-keys:update-schema"
    "//core/notifications:update-schema"
)

buck2 build "${SCHEMA_TARGETS[@]}"

for SCHEMA_TARGET in "${SCHEMA_TARGETS[@]}"; do
  buck2 run "$SCHEMA_TARGET"
done

buck2 run "//dev:update-supergraph-with-existing-schemas"
