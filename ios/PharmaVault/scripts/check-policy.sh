#!/bin/sh
set -eu
pv_policy_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
pv_policy_tmp=$(mktemp -d /private/tmp/pharmavault-u4-policy.XXXXXX)
CLANG_MODULE_CACHE_PATH="$pv_policy_tmp/modules" xcrun swiftc -swift-version 5 \
  -module-cache-path "$pv_policy_tmp/modules" \
  "$pv_policy_dir/PharmaVault/ClientPolicy.swift" "$pv_policy_dir/scripts/PolicySmoke.swift" \
  -o "$pv_policy_tmp/policy-smoke"
"$pv_policy_tmp/policy-smoke"
